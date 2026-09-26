/*
* File: ReservationOperationsService.cs
* Purpose: Handles shared reservation queries, validation, and lifecycle operations.
*/

using API.Data;
using API.DTOs;
using API.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace API.Services
{
    public class ReservationOperationsService
    {
        private const int MaximumCreationWindowDays = 7;
        private const int MinimumNoticeHours = 12;
        private const int MaximumListPage = 1_000_000;
        private const int MaximumListPageSize = 50;
        private const int MaximumSearchLength = 64;
        private const int MaximumIdAttempts = 10;

        private static readonly string[] ListStatuses =
            { "Pending", "Approved", "Declined", "Completed", "Cancelled" };

        private readonly MongoDbContext _context;
        private readonly IMongoCollection<EnergyReservation> _reservations;
        private readonly UserService _userService;
        private readonly QrService _qrService; // QR-VERIFICATION

        public ReservationOperationsService(MongoDbContext context, UserService userService, QrService qrService)
        {
            // Stores shared dependencies context and gets the EnergyReservation collection
            _context = context;
            _userService = userService;
            _qrService = qrService; // QR-VERIFICATION
            _reservations = context.GetCollection<EnergyReservation>(MongoCollectionNames.EnergyReservation);
        }

        public async Task<PagedReservationResult> GetReservationsAsync(ReservationListQuery query)
        {
            // Returns one page of reservations (newest first) across all prosumers, with optional filters
            if (query.Page < 1 || query.Page > MaximumListPage)
            {
                throw new ArgumentException($"Page must be between 1 and {MaximumListPage}.");
            }

            if (query.PageSize < 1 || query.PageSize > MaximumListPageSize)
            {
                throw new ArgumentException($"Page size must be between 1 and {MaximumListPageSize}.");
            }

            var filters = new List<FilterDefinition<EnergyReservation>>();
            var filterBuilder = Builders<EnergyReservation>.Filter;

            var status = query.Status?.Trim();

            if (!string.IsNullOrEmpty(status) &&
                !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
            {
                var normalizedStatus = ListStatuses.FirstOrDefault(s =>
                    string.Equals(s, status, StringComparison.OrdinalIgnoreCase));

                if (normalizedStatus == null)
                {
                    throw new ArgumentException(
                        "Status must be All, Pending, Approved, Declined, Completed, or Cancelled.");
                }

                filters.Add(filterBuilder.Eq(r => r.Status, normalizedStatus));
            }

            var stationId = query.StationId?.Trim();

            if (!string.IsNullOrEmpty(stationId))
            {
                filters.Add(filterBuilder.Eq(r => r.StationId, stationId));
            }

            if (query.DateFrom.HasValue)
            {
                filters.Add(filterBuilder.Gte(r => r.ScheduledTime, ToUtc(query.DateFrom.Value)));
            }

            if (query.DateTo.HasValue)
            {
                var dateTo = ToUtc(query.DateTo.Value);

                // A date without a time covers that whole day
                filters.Add(dateTo.TimeOfDay == TimeSpan.Zero
                    ? filterBuilder.Lt(r => r.ScheduledTime, dateTo.AddDays(1))
                    : filterBuilder.Lte(r => r.ScheduledTime, dateTo));
            }

            if (query.DateFrom.HasValue && query.DateTo.HasValue &&
                ToUtc(query.DateFrom.Value) > ToUtc(query.DateTo.Value))
            {
                throw new ArgumentException("Date from must not be after date to.");
            }

            var search = query.Search?.Trim();

            if (!string.IsNullOrEmpty(search))
            {
                if (search.Length > MaximumSearchLength)
                {
                    throw new ArgumentException($"Search text must be at most {MaximumSearchLength} characters.");
                }

                // Escaped, so the text is always matched literally and cannot inject a regex
                var pattern = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(search), "i");

                filters.Add(filterBuilder.Or(
                    filterBuilder.Regex(r => r.ReservationId, pattern),
                    filterBuilder.Regex(r => r.ProsumerNic, pattern),
                    filterBuilder.Regex(r => r.StationId, pattern)));
            }

            var filter = filters.Count == 0
                ? filterBuilder.Empty
                : filterBuilder.And(filters);

            var totalCount = await _reservations.CountDocumentsAsync(filter);

            var items = await _reservations
                .Find(filter)
                .Sort(Builders<EnergyReservation>.Sort
                    .Descending(r => r.CreatedAt)
                    .Descending(r => r.ReservationId))
                .Skip((query.Page - 1) * query.PageSize)
                .Limit(query.PageSize)
                .ToListAsync();

            return new PagedReservationResult
            {
                Items = items,
                TotalCount = totalCount,
                Page = query.Page,
                PageSize = query.PageSize
            };
        }

        private static DateTime ToUtc(DateTime value)
        {
            return value.Kind switch
            {
                DateTimeKind.Utc => value,
                DateTimeKind.Local => value.ToUniversalTime(),
                _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
            };
        }

        public async Task<List<EnergyReservation>> GetProsumerHistoryAsync(string nic)
        {
            // Returns every reservation (any status) for the given prosumer, newest first
            return await _reservations
                .Find(r => r.ProsumerNic == nic)
                .SortByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        private async Task<string> GenerateReservationIdAsync()
        {
            // Builds a short public ID like RES-48213907 (8 random digits) and retries if it is already taken
            for (var attempt = 0; attempt < MaximumIdAttempts; attempt++)
            {
                var candidate = $"RES-{System.Security.Cryptography.RandomNumberGenerator.GetInt32(10_000_000, 100_000_000)}";

                if (!await _reservations.Find(r => r.ReservationId == candidate).AnyAsync())
                {
                    return candidate;
                }
            }

            throw new InvalidOperationException("A unique reservation ID could not be generated. Please try again.");
        }

        public async Task<EnergyReservation?> GetReservationByIdAsync(string reservationId)
        {
            // Retriews one reservation using its public reservation identifier
            return await _reservations
                .Find(r => r.ReservationId == reservationId)
                .FirstOrDefaultAsync();
        }

        public async Task<EnergyReservation> CreateReservationAsync(
            CreateReservationRequest request,
            string effectiveProsumerNic)
        {
            ArgumentNullException.ThrowIfNull(request);

            if (string.IsNullOrWhiteSpace(effectiveProsumerNic))
            {
                throw new ArgumentException("Prosumer NIC is required", nameof(effectiveProsumerNic));
            }

            if (string.IsNullOrWhiteSpace(request.StationId))
            {
                throw new ArgumentException("Station ID is required", nameof(request.StationId));
            }
            
            if (string.IsNullOrWhiteSpace(request.SlotId))
            {
                throw new ArgumentException("Slot ID is required", nameof(request.SlotId));
            }

            var prosumerNic = effectiveProsumerNic.Trim();
            var stationId = request.StationId.Trim();
            var slotId = request.SlotId.Trim();

            var activeProsumer = await _userService.FindActiveProsumerByNicAsync(prosumerNic);

            if (activeProsumer == null)
            {
                var existingUser = await _userService.FindByNicAsync(prosumerNic);

                if (existingUser == null || existingUser.Role != Roles.Prosumer)
                {
                    throw new KeyNotFoundException("Target Prosumer was not found.");
                }

                if (!existingUser.IsActive)
                {
                    throw new InvalidOperationException("Target account is inactive");
                }

                throw new InvalidOperationException("Target prosumer not available for reservation creation.");
            }

            var station = await GetStationStateAsync(stationId);

            if (!station.Exists)
            {
                throw new KeyNotFoundException("Selected station was not found.");
            }

            if (!station.IsActive)
            {
                throw new InvalidOperationException("Selected station is inactive.");
            }

            var slot = await GetSlotStateAsync(slotId);

            if (!slot.Exists)
            {
                throw new KeyNotFoundException("Selected slot was not found.");
            }

            if (string.IsNullOrWhiteSpace(slot.StationId) ||
                !string.Equals(
                    slot.StationId,
                    stationId,
                    StringComparison.Ordinal))
            {
                throw new ArgumentException("Selected slot does not belong to the selected station.",
                    nameof(request.SlotId));
            }

            if (!slot.IsAvailable)
            {
                throw new InvalidOperationException("Selected slot is unavailable.");
            }

            var utcNow = DateTime.UtcNow;
            var scheduledTimeUtc = request.ScheduledTime.Kind switch
            {
                DateTimeKind.Utc => request.ScheduledTime,
                DateTimeKind.Local => request.ScheduledTime.ToUniversalTime(),
                _ => DateTime.SpecifyKind(request.ScheduledTime, DateTimeKind.Utc)
            };

            ValidateCreationScheduledTime(scheduledTimeUtc, utcNow);

            ValidateScheduledTimeAgainstSlot(scheduledTimeUtc, slot.StartTime, slot.EndTime);

            var reservarion = new EnergyReservation
            {
                ReservationId = await GenerateReservationIdAsync(),
                ProsumerNic = prosumerNic,
                StationId = stationId,
                SlotId = slotId,
                ScheduledTime = scheduledTimeUtc,
                Status = "Pending",
                QrCodeData = null,
                CreatedAt = utcNow,
                UpdatedAt = utcNow
            };

            var slotClaimed = await TryClaimAvailableSlotAsync(slotId, stationId);

            if (!slotClaimed)
            {
                throw new InvalidOperationException("Selected slot is no longer available.");
            }

            try
            {
                await _reservations.InsertOneAsync(reservarion);
                return reservarion;
            }
            catch
            {
                var slotReleased = await ReleaseSlotAsync(slotId, stationId);  

                if (!slotReleased)
                {
                    throw new InvalidOperationException("Reservation creation failed and the claimed slot could not be released.");
                } 
                throw;
            }
        }

        public async Task<EnergyReservation?> UpdateReservationAsync(
            string reservationId,
            UpdateReservationRequest request,
            string? authenticatedProsumerNic,
            bool isGridOperator)
        {
            // Validates authorization and safely updates editable reservation scheduling fields
            ArgumentNullException.ThrowIfNull(request);

            if (string.IsNullOrWhiteSpace(reservationId))
            {
                throw new ArgumentException(
                    "Reservation ID is required.",
                    nameof(reservationId));
            }

            if (string.IsNullOrWhiteSpace(request.StationId))
            {
                throw new ArgumentException(
                    "Station ID is required.",
                    nameof(request.StationId));
            }

            if (string.IsNullOrWhiteSpace(request.SlotId))
            {
                throw new ArgumentException(
                    "Slot ID is required.",
                    nameof(request.SlotId));
            }

            var reservation = await GetReservationByIdAsync(
                reservationId.Trim());

            if (reservation == null)
            {
                return null;
            }

            if (!isGridOperator)
            {
                if (string.IsNullOrWhiteSpace(authenticatedProsumerNic) ||
                    !string.Equals(
                        reservation.ProsumerNic,
                        authenticatedProsumerNic,
                        StringComparison.Ordinal))
                {
                    throw new UnauthorizedAccessException(
                        "A Prosumer may update only their own reservation.");
                }
            }

            if (!string.Equals(
                    reservation.Status,
                    "Pending",
                    StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "Only Pending reservations can be updated.");
            }

            var utcNow = DateTime.UtcNow;

            ValidateMinimumNotice(
                reservation.ScheduledTime,
                utcNow);

            var scheduledTimeUtc = request.ScheduledTime.Kind switch
            {
                DateTimeKind.Utc => request.ScheduledTime,
                DateTimeKind.Local =>
                    request.ScheduledTime.ToUniversalTime(),
                _ => DateTime.SpecifyKind(
                    request.ScheduledTime,
                    DateTimeKind.Utc)
            };

            if (scheduledTimeUtc <= utcNow)
            {
                throw new ArgumentException(
                    "Scheduled time must be in the future.",
                    nameof(request.ScheduledTime));
            }

            ValidateMinimumNotice(scheduledTimeUtc, utcNow);

            var requestedStationId = request.StationId.Trim();
            var requestedSlotId = request.SlotId.Trim();

            var station = await GetStationStateAsync(
                requestedStationId);

            if (!station.Exists)
            {
                throw new KeyNotFoundException(
                    "Selected station was not found.");
            }

            if (!station.IsActive)
            {
                throw new InvalidOperationException(
                    "Selected station is inactive.");
            }

            var slot = await GetSlotStateAsync(requestedSlotId);

            if (!slot.Exists)
            {
                throw new KeyNotFoundException(
                    "Selected slot was not found.");
            }

            if (string.IsNullOrWhiteSpace(slot.StationId) ||
                !string.Equals(
                    slot.StationId,
                    requestedStationId,
                    StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    "Selected slot does not belong to the selected station.",
                    nameof(request.SlotId));
            }

            ValidateScheduledTimeAgainstSlot(
                scheduledTimeUtc,
                slot.StartTime,
                slot.EndTime);

            var slotChanged = !string.Equals(
                reservation.SlotId,
                requestedSlotId,
                StringComparison.Ordinal);

            if (slotChanged && !slot.IsAvailable)
            {
                throw new InvalidOperationException(
                    "Selected replacement slot is unavailable.");
            }

            var replacementSlotClaimed = false;

            if (slotChanged)
            {
                replacementSlotClaimed =
                    await TryClaimAvailableSlotAsync(
                        requestedSlotId,
                        requestedStationId);

                if (!replacementSlotClaimed)
                {
                    throw new InvalidOperationException(
                        "Selected replacement slot is no longer available.");
                }
            }

            var updatedAt = DateTime.UtcNow;

            var reservationFilter =
                Builders<EnergyReservation>.Filter.And(
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.ReservationId,
                        reservation.ReservationId),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.Status,
                        reservation.Status),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.StationId,
                        reservation.StationId),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.SlotId,
                        reservation.SlotId),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.UpdatedAt,
                        reservation.UpdatedAt));

            var reservationUpdate =
                Builders<EnergyReservation>.Update
                    .Set(r => r.StationId, requestedStationId)
                    .Set(r => r.SlotId, requestedSlotId)
                    .Set(r => r.ScheduledTime, scheduledTimeUtc)
                    .Set(r => r.UpdatedAt, updatedAt);

            EnergyReservation? updatedReservation;

            try
            {
                updatedReservation =
                    await _reservations.FindOneAndUpdateAsync(
                        reservationFilter,
                        reservationUpdate,
                        new FindOneAndUpdateOptions<EnergyReservation>
                        {
                            ReturnDocument = ReturnDocument.After
                        });

                if (updatedReservation == null)
                {
                    throw new InvalidOperationException(
                        "The reservation changed before the update could be completed.");
                }
            }
            catch
            {
                if (replacementSlotClaimed)
                {
                    var replacementSlotReleased =
                        await ReleaseSlotAsync(
                            requestedSlotId,
                            requestedStationId);

                    if (!replacementSlotReleased)
                    {
                        throw new InvalidOperationException(
                            "Reservation update failed and the replacement slot could not be released.");
                    }
                }

                throw;
            }

            if (slotChanged)
            {
                var oldSlotReleased = await ReleaseSlotAsync(
                    reservation.SlotId,
                    reservation.StationId);

                if (!oldSlotReleased)
                {
                    var rollbackFilter =
                        Builders<EnergyReservation>.Filter.And(
                            Builders<EnergyReservation>.Filter.Eq(
                                r => r.ReservationId,
                                reservation.ReservationId),
                            Builders<EnergyReservation>.Filter.Eq(
                                r => r.Status,
                                reservation.Status),
                            Builders<EnergyReservation>.Filter.Eq(
                                r => r.StationId,
                                requestedStationId),
                            Builders<EnergyReservation>.Filter.Eq(
                                r => r.SlotId,
                                requestedSlotId),
                            Builders<EnergyReservation>.Filter.Eq(
                                r => r.ScheduledTime,
                                scheduledTimeUtc),
                            Builders<EnergyReservation>.Filter.Eq(
                                r => r.UpdatedAt,
                                updatedAt));

                    var rollbackUpdate =
                        Builders<EnergyReservation>.Update
                            .Set(
                                r => r.StationId,
                                reservation.StationId)
                            .Set(
                                r => r.SlotId,
                                reservation.SlotId)
                            .Set(
                                r => r.ScheduledTime,
                                reservation.ScheduledTime)
                            .Set(
                                r => r.UpdatedAt,
                                reservation.UpdatedAt);

                    var rollbackResult =
                        await _reservations.UpdateOneAsync(
                            rollbackFilter,
                            rollbackUpdate);

                    if (rollbackResult.ModifiedCount != 1)
                    {
                        throw new InvalidOperationException(
                            "The previous slot could not be released and the reservation could not be restored. The replacement slot remains unavailable to protect the stored reservation.");
                    }

                    var originalSlotState =
                        await GetSlotStateAsync(reservation.SlotId);

                    if (!originalSlotState.Exists ||
                        !string.Equals(
                            originalSlotState.StationId,
                            reservation.StationId,
                            StringComparison.Ordinal))
                    {
                        throw new InvalidOperationException(
                            "The reservation was restored, but its original slot could not be validated. The replacement slot remains unavailable to prevent another reservation from claiming it.");
                    }

                    if (originalSlotState.IsAvailable)
                    {
                        var originalSlotReclaimed =
                            await TryClaimAvailableSlotAsync(
                                reservation.SlotId,
                                reservation.StationId);

                        if (!originalSlotReclaimed)
                        {
                            var originalSlotAfterClaim =
                                await GetSlotStateAsync(
                                    reservation.SlotId);

                            var originalSlotIsUnavailable =
                                originalSlotAfterClaim.Exists &&
                                string.Equals(
                                    originalSlotAfterClaim.StationId,
                                    reservation.StationId,
                                    StringComparison.Ordinal) &&
                                !originalSlotAfterClaim.IsAvailable;

                            if (!originalSlotIsUnavailable)
                            {
                                throw new InvalidOperationException(
                                    "The reservation was restored, but its original slot could not be reclaimed. The replacement slot remains unavailable to protect reservation consistency.");
                            }
                        }
                    }

                    var replacementSlotReleased =
                        await ReleaseSlotAsync(
                            requestedSlotId,
                            requestedStationId);

                    if (!replacementSlotReleased)
                    {
                        var replacementSlotAfterRelease =
                            await GetSlotStateAsync(
                                requestedSlotId);

                        var replacementSlotIsAvailable =
                            replacementSlotAfterRelease.Exists &&
                            string.Equals(
                                replacementSlotAfterRelease.StationId,
                                requestedStationId,
                                StringComparison.Ordinal) &&
                            replacementSlotAfterRelease.IsAvailable;

                        if (!replacementSlotIsAvailable)
                        {
                            throw new InvalidOperationException(
                                "The reservation was restored, but the replacement slot could not be released.");
                        }
                    }

                    throw new InvalidOperationException(
                        "The previous slot could not be released. The original reservation and slot allocation were restored.");
                }
            }

            return updatedReservation;
        }

        public async Task<EnergyReservation?> CancelReservationAsync(
            string reservationId,
            string? authenticatedProsumerNic,
            bool isGridOperator)
        {
            // Validates authorization and safely cancels the reservation before releasing its slot
            if (string.IsNullOrWhiteSpace(reservationId))
            {
                throw new ArgumentException(
                    "Reservation ID is required.",
                    nameof(reservationId));
            }

            var reservation = await GetReservationByIdAsync(
                reservationId.Trim());

            if (reservation == null)
            {
                return null;
            }

            if (!isGridOperator)
            {
                if (string.IsNullOrWhiteSpace(authenticatedProsumerNic) ||
                    !string.Equals(
                        reservation.ProsumerNic,
                        authenticatedProsumerNic,
                        StringComparison.Ordinal))
                {
                    throw new UnauthorizedAccessException(
                        "A Prosumer may cancel only their own reservation.");
                }
            }

            if (string.Equals(
                    reservation.Status,
                    "Cancelled",
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "The reservation is already cancelled.");
            }

            if (string.Equals(
                    reservation.Status,
                    "Completed",
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "A completed reservation cannot be cancelled.");
            }

            if (string.Equals(
                    reservation.Status,
                    "Declined",
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "A declined reservation cannot be cancelled.");
            }

            var isCancellableState =
                string.Equals(
                    reservation.Status,
                    "Pending",
                    StringComparison.OrdinalIgnoreCase) ||
                string.Equals(
                    reservation.Status,
                    "Approved",
                    StringComparison.OrdinalIgnoreCase);

            if (!isCancellableState)
            {
                throw new InvalidOperationException(
                    $"A reservation with status '{reservation.Status}' cannot be cancelled.");
            }

            var cancelledAt = DateTime.UtcNow;

            ValidateMinimumNotice(
                reservation.ScheduledTime,
                cancelledAt);

            var associatedSlot = await GetSlotStateAsync(
                reservation.SlotId);

            if (!associatedSlot.Exists ||
                string.IsNullOrWhiteSpace(associatedSlot.StationId) ||
                !string.Equals(
                    associatedSlot.StationId,
                    reservation.StationId,
                    StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "The reservation's associated slot could not be validated.");
            }

            var cancellationFilter =
                Builders<EnergyReservation>.Filter.And(
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.ReservationId,
                        reservation.ReservationId),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.Status,
                        reservation.Status),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.StationId,
                        reservation.StationId),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.SlotId,
                        reservation.SlotId),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.UpdatedAt,
                        reservation.UpdatedAt));

            var cancellationUpdate =
                Builders<EnergyReservation>.Update
                    .Set(r => r.Status, "Cancelled")
                    .Set(r => r.UpdatedAt, cancelledAt);

            // QR-VERIFICATION: a cancelled reservation's QR must stop working immediately
            if (reservation.Qr != null)
            {
                cancellationUpdate = cancellationUpdate.Set(r => r.Qr!.Status, QrStatuses.Revoked);
            }

            var cancelledReservation =
                await _reservations.FindOneAndUpdateAsync(
                    cancellationFilter,
                    cancellationUpdate,
                    new FindOneAndUpdateOptions<EnergyReservation>
                    {
                        ReturnDocument = ReturnDocument.After
                    });

            if (cancelledReservation == null)
            {
                throw new InvalidOperationException(
                    "The reservation changed before cancellation could be completed.");
            }

            if (associatedSlot.IsAvailable)
            {
                return cancelledReservation;
            }

            var slotReleased = await ReleaseSlotAsync(
                reservation.SlotId,
                reservation.StationId);

            if (slotReleased)
            {
                return cancelledReservation;
            }

            var slotAfterReleaseAttempt = await GetSlotStateAsync(
                reservation.SlotId);

            if (slotAfterReleaseAttempt.Exists &&
                slotAfterReleaseAttempt.IsAvailable)
            {
                return cancelledReservation;
            }

            var rollbackFilter =
                Builders<EnergyReservation>.Filter.And(
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.ReservationId,
                        reservation.ReservationId),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.Status,
                        "Cancelled"),
                    Builders<EnergyReservation>.Filter.Eq(
                        r => r.UpdatedAt,
                        cancelledAt));

            var rollbackUpdate =
                Builders<EnergyReservation>.Update
                    .Set(r => r.Status, reservation.Status)
                    .Set(r => r.UpdatedAt, reservation.UpdatedAt);

            // QR-VERIFICATION: restore the QR status that the cancellation revoked
            if (reservation.Qr != null)
            {
                rollbackUpdate = rollbackUpdate.Set(r => r.Qr!.Status, reservation.Qr.Status);
            }

            var rollbackResult = await _reservations.UpdateOneAsync(
                rollbackFilter,
                rollbackUpdate);

            if (rollbackResult.ModifiedCount != 1)
            {
                throw new InvalidOperationException(
                    "The reservation was cancelled, but its slot could not be released and the reservation state could not be restored.");
            }

            throw new InvalidOperationException(
                "Cancellation failed because the associated slot could not be released.");
        }


        public async Task<List<EnergyReservation>> GetPendingReservationAsync(string nic)
        {
            // Returns only Pending reservations belonging to the specified prosumer
            return await _reservations
                .Find(r =>
                    r.ProsumerNic == nic &&
                    r.Status == "Pending")
                .SortByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<(long PendingCount, long ApprovedFutureCount)> GetDashboardCountsAsync(string nic)
        {
            // Counts the Prosumer's Pending reservations and future Approved reservations from MongoDB
            var UtcNow = DateTime.UtcNow;

            var pendingCountTask = _reservations.CountDocumentsAsync(
                r => r.ProsumerNic == nic && 
                r.Status == "Pending"
            );

            var approvedFutureCountTask = _reservations.CountDocumentsAsync(
                r => r.ProsumerNic == nic && 
                r.Status == "Approved" && 
                r.ScheduledTime > UtcNow
            );

            var counts = await Task.WhenAll(
                pendingCountTask,
                approvedFutureCountTask
            );

            return (
                PendingCount: counts[0],
                ApprovedFutureCount: counts[1]
            );
        }

        public static void ValidateCreationScheduledTime(DateTime scheduledTime, DateTime utcNow)
        {
            // Ensures new reservation is no more than seven days away
            if (scheduledTime <= utcNow)
            {
                throw new ArgumentException(
                    "Scheduled time must be in the future",
                    nameof(scheduledTime)
                );
            }

            if (scheduledTime > utcNow.AddDays(MaximumCreationWindowDays))
            {
                throw new ArgumentException(
                    "Reservation must be scheduled within 7 days of creation.",
                    nameof(scheduledTime)
                );
            }
        }

        private static void ValidateMinimumNotice(DateTime scheduledTime, DateTime utcNow)
        {
            // Ensures and update or cancellation has at least twelve hours of notice
            if (scheduledTime < utcNow.AddHours(MinimumNoticeHours))
            {
                throw new InvalidOperationException("Reservation updates and cancellations require at least 12 hours' notice.");
            }
        }

        private async Task<(bool Exists, bool IsActive)> GetStationStateAsync(string stationId)
        {
            // Reads the temporary station dependency through the shared MongoDB context
            var stations = _context.GetCollection<BsonDocument>(MongoCollectionNames.SolarStationInfo);

            var station = await stations
                .Find(Builders<BsonDocument>.Filter.Eq("stationId", stationId))
                .FirstOrDefaultAsync(); 
            
            if (station == null)
            {
                return (Exists: false, IsActive: false);
            }

            var isActive = 
                station.TryGetValue("isActive", out var isActiveValue) && 
                isActiveValue.BsonType == BsonType.Boolean &&
                isActiveValue.AsBoolean;

            return (Exists: true, IsActive: isActive);
        }

        private async Task<(
            bool Exists, 
            string? StationId, 
            DateTime? StartTime, 
            DateTime? EndTime, 
            bool IsAvailable)> GetSlotStateAsync(string slotId)
        {
            var slots = _context.GetCollection<BsonDocument>(MongoCollectionNames.EnergyBookingSlots);

            var slot = await slots
                .Find(Builders<BsonDocument>.Filter.Eq("slotId", slotId))
                .FirstOrDefaultAsync();

            if (slot == null)
            {
                return (
                    Exists: false,
                    StationId: null,
                    StartTime: null,
                    EndTime: null,
                    IsAvailable: false
                );
            }

            var slotStationId =
                slot.TryGetValue("stationId", out var stationIdValue) &&
                stationIdValue.BsonType == BsonType.String
                    ? stationIdValue.AsString
                    : null;

            DateTime? startTime = 
                slot.TryGetValue("startTime", out var startTimeValue) && 
                startTimeValue.BsonType == BsonType.DateTime
                    ? startTimeValue.AsBsonDateTime.ToUniversalTime()
                    : null;

            DateTime? endTime =
                slot.TryGetValue("endTime", out var endTimeValue) &&
                endTimeValue.BsonType == BsonType.DateTime
                    ? endTimeValue.AsBsonDateTime.ToUniversalTime()
                    : null;

            var isAvailable =
                slot.TryGetValue("isAvailable", out var isAvailableValue) &&
                isAvailableValue.BsonType == BsonType.Boolean &&
                isAvailableValue.AsBoolean;

            return (
                Exists: true,
                StationId: slotStationId,
                StartTime: startTime,
                EndTime: endTime,
                IsAvailable: isAvailable
            );
        }

        private async Task<bool> TryClaimAvailableSlotAsync(
            string slotId,
            string stationId)
        {
            // Atomically claims the matching slot only while it remains available
            var slots = _context.GetCollection<BsonDocument>(
                MongoCollectionNames.EnergyBookingSlots);

            var filter = Builders<BsonDocument>.Filter.And(
                Builders<BsonDocument>.Filter.Eq("slotId", slotId),
                Builders<BsonDocument>.Filter.Eq("stationId", stationId),
                Builders<BsonDocument>.Filter.Eq("isAvailable", true));

            var update = Builders<BsonDocument>.Update
                .Set("isAvailable", false);

            var result = await slots.UpdateOneAsync(filter, update);

            return result.ModifiedCount == 1;
        }

        private async Task<bool> ReleaseSlotAsync(
            string slotId,
            string stationId)
        {
            // Releases the matching slot only when it is currently unavailable
            var slots = _context.GetCollection<BsonDocument>(
                MongoCollectionNames.EnergyBookingSlots);

            var filter = Builders<BsonDocument>.Filter.And(
                Builders<BsonDocument>.Filter.Eq("slotId", slotId),
                Builders<BsonDocument>.Filter.Eq("stationId", stationId),
                Builders<BsonDocument>.Filter.Eq("isAvailable", false));

            var update = Builders<BsonDocument>.Update
                .Set("isAvailable", true);

            var result = await slots.UpdateOneAsync(filter, update);

            return result.ModifiedCount == 1;
        }



        private static void ValidateScheduledTimeAgainstSlot(
            DateTime scheduledTime,
            DateTime? slotStartTime,
            DateTime? slotEndTime)
        {
            // Enforces exact UTC equality between the reservation time and selected slot start time
            _ = slotEndTime;

            if (!slotStartTime.HasValue)
            {
                throw new ArgumentException(
                    "Selected slot does not have a valid start time.");
            }

            var scheduledTimeUtc = scheduledTime.Kind switch
            {
                DateTimeKind.Utc => scheduledTime,
                DateTimeKind.Local => scheduledTime.ToUniversalTime(),
                _ => DateTime.SpecifyKind(
                    scheduledTime,
                    DateTimeKind.Utc)
            };

            var slotStartTimeUtc = slotStartTime.Value.Kind switch
            {
                DateTimeKind.Utc => slotStartTime.Value,
                DateTimeKind.Local =>
                    slotStartTime.Value.ToUniversalTime(),
                _ => DateTime.SpecifyKind(
                    slotStartTime.Value,
                    DateTimeKind.Utc)
            };

            if (scheduledTimeUtc != slotStartTimeUtc)
            {
                throw new ArgumentException(
                    "Scheduled time must exactly match the selected slot start time.",
                    nameof(scheduledTime));
            }
        }

        public async Task<EnergyReservation?> UpdateReservationStatusAsync(
            string reservationId,
            string newStatus)
        {
            var normalizedStatus = newStatus.Trim().ToLowerInvariant() switch
            {
                "pending" => "Pending",
                "approved" => "Approved",
                "declined" => "Declined",
                "completed" => "Completed",
                "cancelled" => "Cancelled",
                "canceled" => "Cancelled",
                _ => throw new ArgumentException(
                    "Status must be Pending, Approved, Declined, Completed, or Cancelled.")
            };

            var reservation = await _reservations
                .Find(r => r.ReservationId == reservationId)
                .FirstOrDefaultAsync();

            if (reservation == null)
                return null;

            if (!IsValidStatusTransition(
                    reservation.Status,
                    normalizedStatus))
            {
                throw new InvalidOperationException(
                    $"Cannot change reservation status from '{reservation.Status}' to '{normalizedStatus}'.");
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, normalizedStatus)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            // QR-VERIFICATION: approval issues the signed QR; any other outcome retires an existing QR
            if (normalizedStatus == "Approved")
            {
                var (qr, qrCodeData) = _qrService.CreateInitial(reservation.ReservationId);
                update = update
                    .Set(r => r.Qr, qr)
                    .Set(r => r.QrCodeData, qrCodeData);
            }
            else if (reservation.Qr != null)
            {
                update = update.Set(r => r.Qr!.Status, QrStatuses.Revoked);
            }

            var updatedReservation = await _reservations
                .FindOneAndUpdateAsync(
                    r => r.ReservationId == reservationId &&
                         r.Status == reservation.Status,
                    update,
                    new FindOneAndUpdateOptions<EnergyReservation>
                    {
                        ReturnDocument = ReturnDocument.After
                    });

            if (updatedReservation == null)
            {
                throw new InvalidOperationException(
                    "The reservation status changed before this update could be completed.");
            }

            // A declined reservation must give its slot back, exactly like a cancellation does
            if (normalizedStatus == "Declined")
            {
                await ReleaseSlotOrRollbackDeclineAsync(reservation, updatedReservation);
            }

            return updatedReservation;
        }

        private async Task ReleaseSlotOrRollbackDeclineAsync(
            EnergyReservation original,
            EnergyReservation declined)
        {
            // Releases the declined reservation's slot; if that is impossible, restores the previous state
            if (await ReleaseSlotAsync(original.SlotId, original.StationId))
            {
                return;
            }

            var slotState = await GetSlotStateAsync(original.SlotId);

            if (slotState.Exists && slotState.IsAvailable)
            {
                return;
            }

            var rollbackFilter = Builders<EnergyReservation>.Filter.And(
                Builders<EnergyReservation>.Filter.Eq(r => r.ReservationId, original.ReservationId),
                Builders<EnergyReservation>.Filter.Eq(r => r.Status, "Declined"),
                Builders<EnergyReservation>.Filter.Eq(r => r.UpdatedAt, declined.UpdatedAt));

            var rollbackUpdate = Builders<EnergyReservation>.Update
                .Set(r => r.Status, original.Status)
                .Set(r => r.UpdatedAt, original.UpdatedAt);

            if (original.Qr != null)
            {
                rollbackUpdate = rollbackUpdate.Set(r => r.Qr!.Status, original.Qr.Status);
            }

            var rollbackResult = await _reservations.UpdateOneAsync(rollbackFilter, rollbackUpdate);

            throw new InvalidOperationException(
                rollbackResult.ModifiedCount == 1
                    ? "Decline failed because the associated slot could not be released."
                    : "The reservation was declined, but its slot could not be released and the reservation state could not be restored.");
        }

        private static bool IsValidStatusTransition(
            string currentStatus,
            string newStatus)
        {
            if (string.Equals(
                    currentStatus,
                    newStatus,
                    StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return currentStatus.ToLowerInvariant() switch
            {
                "pending" =>
                    newStatus is "Approved" or "Declined" or "Cancelled",
                "approved" =>
                    newStatus is "Completed" or "Cancelled",
                "declined" => false,
                "completed" => false,
                "cancelled" => false,
                "canceled" => false,
                _ => false
            };
        }
    }
}

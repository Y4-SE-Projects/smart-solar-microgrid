using API.Data;
using API.Models;
using MongoDB.Driver;

namespace API.Services
{
    public class ReservationOperationsService
    {
        private const int MaximumCreationWindowDays = 7;
        private const int MinimumNoticeHours = 12;

        private readonly IMongoCollection<EnergyReservation> _reservations;

        public ReservationOperationsService(MongoDbContext context)
        {
            // Gets the EnergyReservation collection from the shared MongoDB context
            _reservations = context.GetCollection<EnergyReservation>("EnergyReservation");
        }

        public async Task<List<EnergyReservation>> GetProsumerHistoryAsync(string nic)
        {
            // Returns every reservation (any status) for the given prosumer, newest first
            return await _reservations
                .Find(r => r.ProsumerNic == nic)
                .SortByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<EnergyReservation?> GetReservationByIdAsync(string reservationId)
        {
            // Retriews one reservation using its public reservation identifier
            return await _reservations
                .Find(r => r.ReservationId == reservationId)
                .FirstOrDefaultAsync();
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
            var UtcNow = DateTime.UtcNow;

            var pendingCountTask = _reservations.CountDocumentsAsync(
                r => r.ProsumerNic == nic && 
                r.Status == "Pending"
            );

            var approvedFutureCountTask = _reservations.CountDocumentsAsync(
                r => r.ProsumerNic == nic && 
                r.Status == "Pending" && 
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

            return updatedReservation;
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

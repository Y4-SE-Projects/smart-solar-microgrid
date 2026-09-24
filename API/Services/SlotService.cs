// File: SlotService.cs
// Purpose: Business logic and MongoDB data access for energy booking slots.
// Author: IT23215856

using API.Data;
using API.DTOs;
using API.Models;
using MongoDB.Driver;

namespace API.Services
{
    public class SlotService
    {
        // Typed handles to the collections this service works with
        private readonly IMongoCollection<EnergyBookingSlot> _slots;
        private readonly IMongoCollection<SolarStation> _stations;

        // Needed to block a slot edit or re-availability while a reservation still references it
        private readonly IMongoCollection<EnergyReservation> _reservations;

        public SlotService(MongoDbContext context)
        {
            _slots = context.GetCollection<EnergyBookingSlot>(MongoCollectionNames.EnergyBookingSlots);
            _stations = context.GetCollection<SolarStation>(MongoCollectionNames.SolarStationInfo);
            _reservations = context.GetCollection<EnergyReservation>(MongoCollectionNames.EnergyReservation);
        }

        // Rejects a timestamp with no timezone.
        public static DateTime RequireExplicitTimeZone(DateTime value, string fieldName)
        {
            if (value.Kind == DateTimeKind.Unspecified)
            {
                throw new ArgumentException(
                    $"{fieldName} must include a timezone, for example 2026-09-25T08:00:00Z.");
            }

            return value.ToUniversalTime();
        }

        // Checks a slot window is unambiguous and correctly ordered. Returns both times in UTC.
        public static (DateTime StartTime, DateTime EndTime) ValidateSlotWindow(
            DateTime startTime,
            DateTime endTime)
        {
            var start = RequireExplicitTimeZone(startTime, "startTime");
            var end = RequireExplicitTimeZone(endTime, "endTime");

            if (start >= end)
            {
                throw new ArgumentException("startTime must be earlier than endTime.");
            }

            return (start, end);
        }

        // Creates one bookable slot for an existing station.
        public async Task<EnergyBookingSlot> CreateSlotAsync(string stationId, CreateSlotRequest request)
        {
            // Confirms the referenced station actually exists.
            var station = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();

            if (station == null)
            {
                throw new KeyNotFoundException($"No station found with ID '{stationId}'.");
            }

            // Reuses the existing timezone with ordering checks rather than re-validating the same thing a second way
            var (startTime, endTime) = ValidateSlotWindow(request.StartTime, request.EndTime);

            // Rejects a second slot that starts at the exact same time as an existing one is available
            var duplicateExists = await _slots
                .Find(s => s.StationId == stationId && s.StartTime == startTime)
                .AnyAsync();

            if (duplicateExists)
            {
                throw new InvalidOperationException(
                    $"Station '{stationId}' already has a slot starting at {startTime:O}.");
            }

            var newSlot = new EnergyBookingSlot
            {
                SlotId = $"{stationId}-{startTime:yyyyMMddHHmm}",
                StationId = stationId,
                StartTime = startTime,
                EndTime = endTime,
                IsAvailable = true
            };

            await _slots.InsertOneAsync(newSlot);

            return newSlot;
        }

        // Lists every slot for a station, chronological order.
        public async Task<List<EnergyBookingSlot>?> GetSlotsForStationAsync(string stationId)
        {
            var station = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();

            if (station == null)
            {
                return null;
            }

            return await _slots
                .Find(s => s.StationId == stationId)
                .SortBy(s => s.StartTime)
                .ToListAsync();
        }

        // Updates a slot's time window. Blocked while a Pending or Approved reservation
        // still references this slot, since a silent time change would disagree with
        // that reservation's already-recorded ScheduledTime.
        public async Task<EnergyBookingSlot?> UpdateSlotAsync(string slotId, UpdateSlotRequest request)
        {
            var slot = await _slots
                .Find(s => s.SlotId == slotId)
                .FirstOrDefaultAsync();

            if (slot == null)
            {
                return null;
            }

            // Reuses the same timezone and ordering checks used on create
            var (startTime, endTime) = ValidateSlotWindow(request.StartTime, request.EndTime);

            var hasActiveReservation = await _reservations
                .Find(r => r.SlotId == slotId &&
                           (r.Status == "Pending" || r.Status == "Approved"))
                .AnyAsync();

            if (hasActiveReservation)
            {
                throw new InvalidOperationException(
                    $"Slot '{slotId}' cannot be changed while a reservation references it.");
            }

            // Rejects a different slot at the same station that already starts at this new time
            var duplicateExists = await _slots
                .Find(s => s.StationId == slot.StationId &&
                           s.SlotId != slotId &&
                           s.StartTime == startTime)
                .AnyAsync();

            if (duplicateExists)
            {
                throw new InvalidOperationException(
                    $"Station '{slot.StationId}' already has a slot starting at {startTime:O}.");
            }

            var update = Builders<EnergyBookingSlot>.Update
                .Set(s => s.StartTime, startTime)
                .Set(s => s.EndTime, endTime);

            return await _slots.FindOneAndUpdateAsync(
                s => s.SlotId == slotId,
                update,
                new FindOneAndUpdateOptions<EnergyBookingSlot> { ReturnDocument = ReturnDocument.After });
        }

        // Flips a slot's availability. Marking it available again is blocked while a
        // Pending or Approved reservation still holds it, so a Grid Operator override
        // cannot open a slot for double-booking behind an active reservation's back.
        public async Task<EnergyBookingSlot?> SetSlotAvailabilityAsync(string slotId, bool isAvailable)
        {
            var slot = await _slots
                .Find(s => s.SlotId == slotId)
                .FirstOrDefaultAsync();

            if (slot == null)
            {
                return null;
            }

            if (isAvailable)
            {
                var hasActiveReservation = await _reservations
                    .Find(r => r.SlotId == slotId &&
                               (r.Status == "Pending" || r.Status == "Approved"))
                    .AnyAsync();

                if (hasActiveReservation)
                {
                    throw new InvalidOperationException(
                        $"Slot '{slotId}' cannot be marked available while a reservation references it.");
                }
            }

            var update = Builders<EnergyBookingSlot>.Update.Set(s => s.IsAvailable, isAvailable);

            return await _slots.FindOneAndUpdateAsync(
                s => s.SlotId == slotId,
                update,
                new FindOneAndUpdateOptions<EnergyBookingSlot> { ReturnDocument = ReturnDocument.After });
        }
    }
}

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

        // Converts the caller's UTC offset in minutes to a TimeSpan, rejecting offsets no real timezone uses
        public static TimeSpan RequireUtcOffset(int utcOffsetMinutes)
        {
            if (utcOffsetMinutes < -720 || utcOffsetMinutes > 840)
            {
                throw new ArgumentException("utcOffsetMinutes must be between -720 and 840.");
            }

            return TimeSpan.FromMinutes(utcOffsetMinutes);
        }

        // Rejects slot changes on a deactivated station or one whose schedule can't be read, and returns the schedule
        private static StationSchedule RequireSlotRules(SolarStation station)
        {
            if (!station.IsActive)
            {
                throw new InvalidOperationException(
                    $"Station '{station.StationId}' is deactivated. Reactivate it before changing its slots.");
            }

            if (!StationSchedule.TryParse(station.Schedule, out var schedule))
            {
                throw new InvalidOperationException(
                    $"Station '{station.StationId}' has no readable operating hours. Set them on the station first.");
            }

            return schedule!;
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

        // Lists a station's slots that start in one calendar month, in chronological order
        public async Task<List<EnergyBookingSlot>?> GetSlotsForStationInMonthAsync(string stationId, int year, int month)
        {
            var station = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();

            if (station == null)
            {
                return null;
            }

            // Pads the month by a day on each side so a caller in any timezone gets every slot in its local month
            var monthStart = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var from = monthStart.AddDays(-1);
            var to = monthStart.AddMonths(1).AddDays(1);

            return await _slots
                .Find(s => s.StationId == stationId && s.StartTime >= from && s.StartTime < to)
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

            // Loads the slot's station so the edit can be checked against its state and schedule
            var station = await _stations
                .Find(s => s.StationId == slot.StationId)
                .FirstOrDefaultAsync();

            if (station == null)
            {
                throw new InvalidOperationException($"The station for slot '{slotId}' no longer exists.");
            }

            var schedule = RequireSlotRules(station);

            // Compares against the schedule in the caller's local time
            var utcOffset = RequireUtcOffset(request.UtcOffsetMinutes);
            var localStart = startTime + utcOffset;
            var localEnd = endTime + utcOffset;

            if (localEnd.Date != localStart.Date)
            {
                throw new ArgumentException("A slot must start and end on the same day.");
            }

            if (!schedule.Covers(localStart.TimeOfDay, localEnd.TimeOfDay))
            {
                throw new ArgumentException($"Slots must fall within the station's hours, {schedule.HoursLabel()}.");
            }

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
                    $"Station '{slot.StationId}' already has a slot starting at this time.");
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

        // Generates one slot per selected weekday within, all sharing the same time-of-day. A day that already has a slot starting at that exact time is skipped.
        public async Task<(List<EnergyBookingSlot> Created, List<SkippedSlotOccurrence> Skipped)> GenerateRecurringSlotsAsync(
            string stationId,
            CreateSlotRequest request)
        {
            var station = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();

            if (station == null)
            {
                throw new KeyNotFoundException($"No station found with ID '{stationId}'.");
            }

            // Refuses deactivated stations and stations whose schedule can't be read
            var schedule = RequireSlotRules(station);

            if (request.DaysOfWeek == null || request.DaysOfWeek.Count == 0)
            {
                throw new ArgumentException("At least one day of week is required.");
            }

            // Parses each day name against System.DayOfWeek, rejecting typos such as "Mondey"
            var selectedDays = new HashSet<DayOfWeek>();
            foreach (var dayName in request.DaysOfWeek)
            {
                if (!Enum.TryParse<DayOfWeek>(dayName, ignoreCase: true, out var day))
                {
                    throw new ArgumentException($"'{dayName}' is not a valid day of week.");
                }
                selectedDays.Add(day);
            }

            if (!TimeSpan.TryParseExact(request.StartTime, @"hh\:mm", null, out var startTimeOfDay))
            {
                throw new ArgumentException("startTime must be in HH:mm format, e.g. 08:00.");
            }

            if (!TimeSpan.TryParseExact(request.EndTime, @"hh\:mm", null, out var endTimeOfDay))
            {
                throw new ArgumentException("endTime must be in HH:mm format, e.g. 18:00.");
            }

            if (startTimeOfDay >= endTimeOfDay)
            {
                throw new ArgumentException("startTime must be earlier than endTime.");
            }

            // Rejects a time window outside the station's opening hours
            if (!schedule.Covers(startTimeOfDay, endTimeOfDay))
            {
                throw new ArgumentException($"Slots must fall within the station's hours, {schedule.HoursLabel()}.");
            }

            // Shifts the range into the caller's local time before taking calendar dates
            var utcOffset = RequireUtcOffset(request.UtcOffsetMinutes);
            var rangeStart = (RequireExplicitTimeZone(request.RangeStart, "rangeStart") + utcOffset).Date;
            var rangeEnd = (RequireExplicitTimeZone(request.RangeEnd, "rangeEnd") + utcOffset).Date;

            if (rangeStart > rangeEnd)
            {
                throw new ArgumentException("rangeStart must not be after rangeEnd.");
            }

            // Caps one request at a year of slots
            if ((rangeEnd - rangeStart).TotalDays > 366)
            {
                throw new ArgumentException("The date range cannot span more than a year.");
            }

            var created = new List<EnergyBookingSlot>();
            var skipped = new List<SkippedSlotOccurrence>();

            for (var date = rangeStart; date <= rangeEnd; date = date.AddDays(1))
            {
                if (!selectedDays.Contains(date.DayOfWeek))
                {
                    continue;
                }

                // Builds the slot in local time on this day, then converts to UTC for storage
                var startTime = DateTime.SpecifyKind(date.Add(startTimeOfDay) - utcOffset, DateTimeKind.Utc);
                var endTime = DateTime.SpecifyKind(date.Add(endTimeOfDay) - utcOffset, DateTimeKind.Utc);

                var duplicateExists = await _slots
                    .Find(s => s.StationId == stationId && s.StartTime == startTime)
                    .AnyAsync();

                if (duplicateExists)
                {
                    skipped.Add(new SkippedSlotOccurrence
                    {
                        StartTime = startTime,
                        Reason = $"Already has a slot at {request.StartTime}."
                    });
                    continue;
                }

                var slot = new EnergyBookingSlot
                {
                    SlotId = $"{stationId}-{startTime:yyyyMMddHHmm}",
                    StationId = stationId,
                    StartTime = startTime,
                    EndTime = endTime,
                    IsAvailable = true
                };

                await _slots.InsertOneAsync(slot);
                created.Add(slot);
            }

            return (created, skipped);
        }

        // Permanently removes a slot. Blocked if any reservation, in any status, was ever made against it
        public async Task<EnergyBookingSlot?> DeleteSlotAsync(string slotId)
        {
            // Looks up the slot (404 if not found)
            var slot = await _slots
                .Find(s => s.SlotId == slotId)
                .FirstOrDefaultAsync();

            if (slot == null)
            {
                return null;
            }

            // Blocks deletion if any reservation, in any status, references this slot
            var hasAnyReservations = await _reservations
                .Find(r => r.SlotId == slotId)
                .AnyAsync();

            if (hasAnyReservations)
            {
                throw new InvalidOperationException(
                    $"Slot '{slotId}' cannot be deleted because reservations reference it.");
            }

            // Permanently removes the document (not a soft delete)
            await _slots.DeleteOneAsync(s => s.SlotId == slotId);

            // Returns the deleted slot's data
            return slot;
        }
    }
}

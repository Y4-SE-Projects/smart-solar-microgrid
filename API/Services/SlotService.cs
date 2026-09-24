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

        public SlotService(MongoDbContext context)
        {
            _slots = context.GetCollection<EnergyBookingSlot>(MongoCollectionNames.EnergyBookingSlots);
            _stations = context.GetCollection<SolarStation>(MongoCollectionNames.SolarStationInfo);
        }

        // Rejects a timestamp with no timezone, because .NET reads it as server local time and
        // silently shifts it. Returns the value converted to UTC.
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
            // Confirms the referenced station actually exists — stationId here
            // is a foreign key, and a typo'd one would otherwise silently
            // create a slot with no matching station behind it
            var station = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();

            if (station == null)
            {
                throw new KeyNotFoundException($"No station found with ID '{stationId}'.");
            }

            // Reuses the existing timezone + ordering checks rather than
            // re-validating the same thing a second way
            var (startTime, endTime) = ValidateSlotWindow(request.StartTime, request.EndTime);

            // Rejects a second slot that starts at the exact same time as an
            // existing one for this station — that would just be a confusing
            // duplicate of the same bookable window
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
                // Server-generated and naturally unique per station + start
                // time — the client never supplies this
                SlotId = $"{stationId}-{startTime:yyyyMMddHHmm}",
                StationId = stationId,
                StartTime = startTime,
                EndTime = endTime,
                IsAvailable = true
            };

            await _slots.InsertOneAsync(newSlot);

            return newSlot;
        }
    }
}

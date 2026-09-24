// File: SlotService.cs
// Purpose: Business logic and MongoDB data access for energy booking slots.
// Author: IT23215856

using API.Data;
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
    }
}

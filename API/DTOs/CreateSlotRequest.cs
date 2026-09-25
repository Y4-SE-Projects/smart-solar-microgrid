// File: CreateSlotRequest.cs
// Purpose: POST request body for /api/stations/{stationId}/slots.
// Author: IT23215856

namespace API.DTOs
{
    public class CreateSlotRequest
    {
        // Weekdays to generate a slot on, e.g. ["Monday", "Friday"], matching System.DayOfWeek names
        public List<string> DaysOfWeek { get; set; } = new();

        // Time of day applied to every generated slot, "HH:mm", e.g. "08:00"
        public string StartTime { get; set; } = string.Empty;

        // Time of day applied to every generated slot, "HH:mm", e.g. "18:00"
        public string EndTime { get; set; } = string.Empty;

        // First day to consider, with an explicit timezone, e.g. "2026-10-01T00:00:00Z"
        public DateTime RangeStart { get; set; }

        // Last day to consider (inclusive), with an explicit timezone
        public DateTime RangeEnd { get; set; }

        // The caller's offset from UTC in minutes, e.g. 330 for Sri Lanka; days and times are read in that local time
        public int UtcOffsetMinutes { get; set; }
    }
}

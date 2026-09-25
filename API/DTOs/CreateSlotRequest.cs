// File: CreateSlotRequest.cs
// Purpose: POST request body for /api/stations/{stationId}/slots.
// Author: IT23215856

namespace API.DTOs
{
    public class CreateSlotRequest
    {
        // Weekdays to generate a slot on, e.g. ["Monday", "Wednesday", "Friday"] — must match
        // a System.DayOfWeek name (case-insensitive).
        public List<string> DaysOfWeek { get; set; } = new();

        // Time-of-day applied to every generated slot, "HH:mm", e.g. "01:00".
        public string StartTime { get; set; } = string.Empty;

        // Time-of-day applied to every generated slot, "HH:mm", e.g. "14:00".
        public string EndTime { get; set; } = string.Empty;

        // First day to consider. Must include an explicit timezone, e.g. "2026-10-01T00:00:00Z".
        public DateTime RangeStart { get; set; }

        // Last day to consider (inclusive). Must include an explicit timezone.
        public DateTime RangeEnd { get; set; }

        // The caller's offset from UTC in minutes, e.g. 330 for Sri Lanka (UTC+05:30). The range
        // days and the StartTime/EndTime of day are read as the caller's local wall-clock time.
        public int UtcOffsetMinutes { get; set; }
    }
}

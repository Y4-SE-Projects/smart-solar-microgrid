// File: UpdateSlotRequest.cs
// Purpose: PUT request body for /api/slots/{slotId}.
// Author: IT23215856

namespace API.DTOs
{
    public class UpdateSlotRequest
    {
        // Must include an explicit timezone, e.g. "2026-09-25T08:00:00Z"
        public DateTime StartTime { get; set; }

        public DateTime EndTime { get; set; }

        // The caller's offset from UTC in minutes, e.g. 330 for Sri Lanka, used to check the station's schedule
        public int UtcOffsetMinutes { get; set; }
    }
}

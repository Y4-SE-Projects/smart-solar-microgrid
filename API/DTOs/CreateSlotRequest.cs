// File: CreateSlotRequest.cs
// Purpose: POST request body for /api/stations/{stationId}/slots.
// Author: IT23215856

namespace API.DTOs
{
    public class CreateSlotRequest
    {
        // Must include an explicit timezone, e.g. "2026-09-25T08:00:00Z" —
        public DateTime StartTime { get; set; }

        public DateTime EndTime { get; set; }
    }
}

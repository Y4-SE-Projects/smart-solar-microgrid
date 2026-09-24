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
    }
}

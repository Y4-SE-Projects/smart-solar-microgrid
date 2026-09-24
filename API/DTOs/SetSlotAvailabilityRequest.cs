// File: SetSlotAvailabilityRequest.cs
// Purpose: PUT request body for /api/slots/{slotId}/availability.
// Author: IT23215856

namespace API.DTOs
{
    public class SetSlotAvailabilityRequest
    {
        public bool IsAvailable { get; set; }
    }
}

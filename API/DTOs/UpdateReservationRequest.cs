/*
* File: UpdateReservationRequest.cs
* Purpose: Defines the editable scheduling fields for updating an energy reservation.    
*/

namespace API.DTOs
{
    public class UpdateReservationRequest
    {
        public string StationId { get; set; } = string.Empty;

        public string SlotId { get; set; } = string.Empty;

        public DateTime ScheduledTime { get; set; }
    }
}
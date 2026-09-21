namespace API.DTOs
{
    public class updateReservationRequest
    {
        public string StationId { get; set; } = string.Empty;

        public string SlotId { get; set; } = string.Empty;

        public DateTime ScheduledTime {get; set; }
    }
}
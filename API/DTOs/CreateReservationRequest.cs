namespace API.DTOs
{
    public class CreateReservationRequest
    {
        public string? ProsumerNic { get; set; }

        public string StationId { get; set; } = string.Empty;

        public string SlotId { get; set; } = string.Empty;

        public DateTime ScheduledTime { get; set; }
    }
}
using System.Text.Json.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace API.Models
{
    [BsonIgnoreExtraElements]
    public class EnergyReservation
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("reservationId")]
        public string ReservationId { get; set; } = string.Empty;

        [BsonElement("prosumerNic")]
        public string ProsumerNic { get; set; } = string.Empty;

        [BsonElement("stationId")]
        public string StationId { get; set; } = string.Empty;

        [BsonElement("slotId")]
        public string SlotId { get; set; } = string.Empty;

        [BsonElement("scheduledTime")]
        public DateTime ScheduledTime { get; set; }

        [BsonElement("status")]
        public string Status { get; set; } = string.Empty;

        // QR-VERIFICATION: hidden from every JSON response so only the owner-only GET {id}/qr can reveal it.
        [JsonIgnore]
        [BsonElement("qrCodeData")]
        public string? QrCodeData { get; set; }

        // QR-VERIFICATION: embedded QR state ( nonce, version, status, scan audit ). Never serialized to clients.
        [JsonIgnore]
        [BsonElement("qr")]
        public QrInfo? Qr { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; }

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; }
    }
}
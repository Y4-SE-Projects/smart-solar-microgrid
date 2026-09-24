// File: EnergyBookingSlot.cs
// Purpose: Document model for one bookable time window in the EnergyBookingSlots collection.
// Author: IT23215856

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace API.Models
{
    [BsonIgnoreExtraElements]
    public class EnergyBookingSlot
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        // Human-readable slot code used by the rest of the system, e.g. "SLOT-001"
        [BsonElement("slotId")]
        public string SlotId { get; set; } = string.Empty;

        // References SolarStation.StationId, the station this slot belongs to
        [BsonElement("stationId")]
        public string StationId { get; set; } = string.Empty;

        // Start of the bookable window, stored in UTC. A reservation's scheduledTime is this value
        [BsonElement("startTime")]
        [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
        public DateTime StartTime { get; set; }

        // End of the bookable window, stored in UTC. Must be later than StartTime
        [BsonElement("endTime")]
        [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
        public DateTime EndTime { get; set; }

        // False once the slot is taken by a reservation, or when an operator marks it unavailable
        [BsonElement("isAvailable")]
        public bool IsAvailable { get; set; } = true;
    }
}

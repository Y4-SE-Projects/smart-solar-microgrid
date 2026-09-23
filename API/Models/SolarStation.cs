// File: SolarStation.cs
// Purpose: Document model for one microgrid station in the SolarStationInfo MongoDB collection.
// Author: IT23215856

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace API.Models
{
    [BsonIgnoreExtraElements]
    public class SolarStation
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        // Human-readable station code, e.g. "STN-001"
        [BsonElement("stationId")]
        public string StationId { get; set; } = string.Empty;

        // Display name shown to users, e.g. "Colombo North Hub"
        [BsonElement("name")]
        public string Name { get; set; } = string.Empty;

        // GPS latitude
        [BsonElement("latitude")]
        public double Latitude { get; set; }

        // GPS longitude
        [BsonElement("longitude")]
        public double Longitude { get; set; }

        // Total energy capacity of the station
        [BsonElement("capacityKWh")]
        public double CapacityKWh { get; set; }

        // Number of physical battery slots available
        [BsonElement("batterySlotCount")]
        public int BatterySlotCount { get; set; }

        // Operating hours, e.g. "Mon-Sun 06:00-22:00"
        [BsonElement("schedule")]
        public string Schedule { get; set; } = string.Empty;

        // Operational status (false once deactivated)
        [BsonElement("isActive")]
        public bool IsActive { get; set; }

        // Timestamp for when this station record was created
        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; }
    }
}

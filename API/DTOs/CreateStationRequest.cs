// File: CreateStationRequest.cs
// Purpose: POST request body for /api/stations.
// Author: IT23215856

namespace API.DTOs
{
    public class CreateStationRequest
    {
        // Human-readable station code, e.g. "STN-001". Must be unique.
        public string? StationId { get; set; }

        // Display name shown to users, e.g. "Colombo North Hub".
        public string? Name { get; set; }

        // GPS latitude
        public double Latitude { get; set; }

        // GPS longitude
        public double Longitude { get; set; }

        // Total energy capacity of the station
        public double CapacityKWh { get; set; }

        // Number of physical battery slots available at this station.
        public int BatterySlotCount { get; set; }

        // Operating hours, e.g. "Mon-Sun 06:00-22:00".
        public string? Schedule { get; set; }
    }
}

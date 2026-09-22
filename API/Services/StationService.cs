// File: StationService.cs
// Purpose: Business logic and MongoDB data access for microgrid stations. (Has all station validation and business rules)
// Author: IT23215856

using API.Data;
using API.DTOs;
using API.Models;
using MongoDB.Driver;

namespace API.Services
{
    public class StationService
    {
        // Typed handle to the SolarStationInfo collection, fetched once in the constructor and reused by every method below
        private readonly IMongoCollection<SolarStation> _stations;

        public StationService(MongoDbContext context)
        {
            // Asks the shared (singleton) MongoDB context for the SolarStationInfo collection, using the shared name constant rather than a literal string
            _stations = context.GetCollection<SolarStation>(MongoCollectionNames.SolarStationInfo);
        }

        // Validates required field, rejects a duplicate station ID, inserts the new station.
        public async Task<SolarStation> CreateStationAsync(CreateStationRequest request)
        {
            // Trims the text fields once so " STN-001 " cannot slip past the duplicate check
            var stationId = request.StationId?.Trim() ?? string.Empty;
            var name = request.Name?.Trim() ?? string.Empty;
            var schedule = request.Schedule?.Trim() ?? string.Empty;

            // Rejects missing required text fields
            if (string.IsNullOrWhiteSpace(stationId))
            {
                throw new ArgumentException("Station ID is required.");
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("Station name is required.");
            }

            if (string.IsNullOrWhiteSpace(schedule))
            {
                throw new ArgumentException("Schedule is required.");
            }

            // Rejects out-of-range GPS coordinates
            if (request.Latitude < -90 || request.Latitude > 90 ||
                request.Longitude < -180 || request.Longitude > 180)
            {
                throw new ArgumentException(
                    "Latitude must be between -90 and 90, and longitude between -180 and 180.");
            }

            // Rejects capacity and battery slot counts that make no physical sense
            if (request.CapacityKWh <= 0)
            {
                throw new ArgumentException("Capacity (kWh) must be greater than 0.");
            }

            if (request.BatterySlotCount < 1)
            {
                throw new ArgumentException("Battery slot count must be at least 1.");
            }

            // Looks for an existing station with the same station ID
            var existingStation = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();

            // Blocks the request if that station ID is already taken
            if (existingStation != null)
            {
                throw new InvalidOperationException(
                    $"A station with ID '{stationId}' already exists.");
            }

            // Builds the document from the request, so the client can never set the Mongo _id, the active flag or the creation timestamp itself
            var newStation = new SolarStation
            {
                StationId = stationId,
                Name = name,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                CapacityKWh = request.CapacityKWh,
                BatterySlotCount = request.BatterySlotCount,
                Schedule = schedule,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            // Saves the new station document into MongoDB
            await _stations.InsertOneAsync(newStation);

            // Returns the saved station, including its generated Id
            return newStation;
        }
    }
}

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

        // Needed to check for active reservations before a station is deactivated.
        private readonly IMongoCollection<EnergyReservation> _reservations;

        public StationService(MongoDbContext context)
        {
            // Asks the shared (singleton) MongoDB context for the SolarStationInfo collection, using the shared name constant rather than a literal string
            _stations = context.GetCollection<SolarStation>(MongoCollectionNames.SolarStationInfo);
            _reservations = context.GetCollection<EnergyReservation>(MongoCollectionNames.EnergyReservation);
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

        // Returns every station, or only the active ones when activeOnly is true.
        public async Task<List<SolarStation>> GetAllStationsAsync(bool activeOnly = false)
        {
            // Builds a filter matching active stations only, or all stations
            var filter = activeOnly
                ? Builders<SolarStation>.Filter.Eq(s => s.IsActive, true)
                : Builders<SolarStation>.Filter.Empty;

            // Sorted by station ID for stable, predictable ordering
            return await _stations
                .Find(filter)
                .SortBy(s => s.StationId)
                .ToListAsync();
        }
        
        // Returns nearby stations to your current location
        public async Task<List<SolarStation>> GetNearbyStationsAsync(double lat, double lng, double radiusKm)
        {
            // Same coordinate validation as CreateStationAsync, applied to
            // the caller's search point rather than a station's location
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
            {
                throw new ArgumentException(
                    "Latitude must be between -90 and 90, and longitude between -180 and 180.");
            }
 
            if (radiusKm <= 0)
            {
                throw new ArgumentException("radiusKm must be greater than 0.");
            }
 
            // Only active stations are worth suggesting — no point sending
            // someone toward a station that's currently deactivated
            var activeStations = await _stations
                .Find(Builders<SolarStation>.Filter.Eq(s => s.IsActive, true))
                .ToListAsync();
 
            // Computes the straight-line distance to each station in memory
            // and keeps only the ones inside the requested radius, nearest
            // first. Fine at this project's scale; a large station count
            // would eventually want a MongoDB geospatial index instead.
            return activeStations
                .Select(s => new
                {
                    Station = s,
                    DistanceKm = HaversineDistanceKm(lat, lng, s.Latitude, s.Longitude)
                })
                .Where(x => x.DistanceKm <= radiusKm)
                .OrderBy(x => x.DistanceKm)
                .Select(x => x.Station)
                .ToList();
        }
 
        private static double HaversineDistanceKm(double lat1, double lon1, double lat2, double lon2)
        {
            // Standard great-circle distance formula between two GPS points
            const double earthRadiusKm = 6371.0;
            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);
 
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
 
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
 
            return earthRadiusKm * c;
        }
 
        private static double ToRadians(double degrees) => degrees * (Math.PI / 180);

        // Deactivate stations that dont have any reservations.
        public async Task<SolarStation?> DeactivateStationAsync(string stationId)
        {
            // Looks up the station first so the controller can return a clean (404 if not found)
            var station = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();
 
            if (station == null)
            {
                // Signals "not found" the same way UpdateReservationStatusAsync does elsewhere in this project — return null and let the
                return null;
            }
 
            if (!station.IsActive)
            {
                throw new InvalidOperationException(
                    $"Station '{stationId}' is already deactivated.");
            }
 
            // Block deactivation while any reservation for this station is still unresolved
            var hasActiveReservations = await _reservations
                .Find(r => r.StationId == stationId &&
                           (r.Status == "Pending" || r.Status == "Approved"))
                .AnyAsync();
 
            if (hasActiveReservations)
            {
                throw new InvalidOperationException(
                    $"Station '{stationId}' cannot be deactivated while it has active reservations.");
            }
 
            // Only the IsActive flag changes, every other field on the station record stays exactly as it was
            var update = Builders<SolarStation>.Update.Set(s => s.IsActive, false);
 
            return await _stations.FindOneAndUpdateAsync(
                s => s.StationId == stationId,
                update,
                new FindOneAndUpdateOptions<SolarStation> { ReturnDocument = ReturnDocument.After });
        }

        // Reactivate stations that are deactivated.
        public async Task<SolarStation?> ReactivateStationAsync(string stationId)
        {
            // Same "not found, null" pattern as DeactivateStationAsync
            var station = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();
 
            if (station == null)
            {
                return null;
            }
 
            if (station.IsActive)
            {
                throw new InvalidOperationException(
                    $"Station '{stationId}' is already active.");
            }
 
            var update = Builders<SolarStation>.Update.Set(s => s.IsActive, true);
 
            return await _stations.FindOneAndUpdateAsync(
                s => s.StationId == stationId,
                update,
                new FindOneAndUpdateOptions<SolarStation> { ReturnDocument = ReturnDocument.After });
        }

        // Update station details.
        public async Task<SolarStation?> UpdateStationAsync(string stationId, UpdateStationRequest request)
        {
            // Same coordinate validation as CreateStationAsync, applied to the new location the client is submitting
            if (request.Latitude < -90 || request.Latitude > 90 ||
                request.Longitude < -180 || request.Longitude > 180)
            {
                throw new ArgumentException(
                    "Latitude must be between -90 and 90, and longitude between -180 and 180.");
            }
 
            // Lists every field that's allowed to change.
            var update = Builders<SolarStation>.Update
                .Set(s => s.Name, request.Name.Trim())
                .Set(s => s.Latitude, request.Latitude)
                .Set(s => s.Longitude, request.Longitude)
                .Set(s => s.CapacityKWh, request.CapacityKWh)
                .Set(s => s.BatterySlotCount, request.BatterySlotCount)
                .Set(s => s.Schedule, request.Schedule.Trim());
 
            // Same "not found, null" pattern used by above 2 methods.
            return await _stations.FindOneAndUpdateAsync(
                s => s.StationId == stationId,
                update,
                new FindOneAndUpdateOptions<SolarStation> { ReturnDocument = ReturnDocument.After });
        }

        // Hard delete a station from database.
        public async Task<SolarStation?> DeleteStationAsync(string stationId)
        {
            // Looks up the station (404 if not found)
            var station = await _stations
                .Find(s => s.StationId == stationId)
                .FirstOrDefaultAsync();
 
            if (station == null)
            {
                return null;
            }
 
            // Blocks deletion if any reservation, in any status, was ever made against this station
            var hasAnyReservations = await _reservations
                .Find(r => r.StationId == stationId)
                .AnyAsync();
 
            if (hasAnyReservations)
            {
                throw new InvalidOperationException(
                    $"Station '{stationId}' cannot be deleted because reservations reference it.");
            }
 
            // Permanently removes the document (Not a soft delete)
            await _stations.DeleteOneAsync(s => s.StationId == stationId);
 
            // Returns the now-deleted station's data to confirm exactly what was removed
            return station;
        }
    }
}

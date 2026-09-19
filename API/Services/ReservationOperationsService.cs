using API.Data;
using API.Models;
using MongoDB.Driver;

namespace API.Services
{
    public class ReservationOperationsService
    {
        private readonly IMongoCollection<EnergyReservation> _reservations;

        public ReservationOperationsService(MongoDbContext context)
        {
            // Gets the EnergyReservation collection from the shared MongoDB context
            _reservations = context.GetCollection<EnergyReservation>("EnergyReservation");
        }

        public async Task<List<EnergyReservation>> GetProsumerHistoryAsync(string nic)
        {
            // Returns every reservation (any status) for the given prosumer, newest first
            return await _reservations
                .Find(r => r.ProsumerNic == nic)
                .SortByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<EnergyReservation>> GetPendingReservationAsync(string nic)
        {
            return await _reservations
                .Find(r =>
                    r.ProsumerNic == nic &&
                    r.Status == "Pending")
                .SortByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<EnergyReservation?> UpdateReservationStatusAsync(
            string reservationId,
            string newStatus)
        {
            var normalizedStatus = newStatus.Trim().ToLowerInvariant() switch
            {
                "pending" => "Pending",
                "approved" => "Approved",
                "declined" => "Declined",
                "completed" => "Completed",
                "cancelled" => "Cancelled",
                "canceled" => "Cancelled",
                _ => throw new ArgumentException(
                    "Status must be Pending, Approved, Declined, Completed, or Cancelled.")
            };

            var reservation = await _reservations
                .Find(r => r.ReservationId == reservationId)
                .FirstOrDefaultAsync();

            if (reservation == null)
                return null;

            if (!IsValidStatusTransition(
                    reservation.Status,
                    normalizedStatus))
            {
                throw new InvalidOperationException(
                    $"Cannot change reservation status from '{reservation.Status}' to '{normalizedStatus}'.");
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, normalizedStatus)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var updatedReservation = await _reservations
                .FindOneAndUpdateAsync(
                    r => r.ReservationId == reservationId &&
                         r.Status == reservation.Status,
                    update,
                    new FindOneAndUpdateOptions<EnergyReservation>
                    {
                        ReturnDocument = ReturnDocument.After
                    });

            if (updatedReservation == null)
            {
                throw new InvalidOperationException(
                    "The reservation status changed before this update could be completed.");
            }

            return updatedReservation;
        }

        private static bool IsValidStatusTransition(
            string currentStatus,
            string newStatus)
        {
            if (string.Equals(
                    currentStatus,
                    newStatus,
                    StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return currentStatus.ToLowerInvariant() switch
            {
                "pending" =>
                    newStatus is "Approved" or "Declined" or "Cancelled",
                "approved" =>
                    newStatus is "Completed" or "Cancelled",
                "declined" => false,
                "completed" => false,
                "cancelled" => false,
                "canceled" => false,
                _ => false
            };
        }
    }
}

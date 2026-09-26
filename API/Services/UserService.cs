/* File: UserService.cs
 * Purpose: Reusable MongoDB lookup/creation methods against the Users collection.
 * Author: IT23218512
 */

using API.Data;
using API.Models;
using MongoDB.Driver;

namespace API.Services
{
    public class UserService
    {
        private readonly IMongoCollection<User> _users;

        // Constructor: gets a typed handle to the Users collection via the shared MongoDbContext.
        public UserService(MongoDbContext context)
        {
            _users = context.GetCollection<User>(MongoCollectionNames.Users);
        }

        // Finds any user (any role) by NIC. Returns null if not found.
        public async Task<User?> FindByNicAsync(string nic)
        {
            return await _users.Find(u => u.Nic == nic).FirstOrDefaultAsync();
        }

        // Finds a Backoffice / GridOperator user by username. Returns null if not found.
        public async Task<User?> FindByUsernameAsync(string username)
        {
            return await _users.Find(u => u.Username == username).FirstOrDefaultAsync();
        }

        // Finds a Prosumer by NIC, but only if the account is currently active.
        public async Task<User?> FindActiveProsumerByNicAsync(string nic)
        {
            return await _users.Find(u => u.Nic == nic && u.Role == Roles.Prosumer && u.IsActive)
                                .FirstOrDefaultAsync();
        }

        // True if a user with this NIC already exists (duplicate-registration check).
        // A deactivated Prosumer must not be able to register a fresh one against the same NIC. 
        // ( Their only route back is a reactivation request. )
        public async Task<bool> NicExistsAsync(string nic)
        {
            return await _users.Find(u => u.Nic == nic).AnyAsync();
        }

        // True if a user with this username already exists (duplicate-registration check).
        public async Task<bool> UsernameExistsAsync(string username)
        {
            return await _users.Find(u => u.Username == username).AnyAsync();
        }

        // Inserts a new user document. ( Assumes the caller already validated fields and hashed the password )
        public async Task CreateUserAsync(User user)
        {
            await _users.InsertOneAsync(user);
        }

        // Updates the editable profile fields for a Prosumer's own account.
        // Nic and Role are never touched here — those can't change via this call.
        public async Task UpdateProfileAsync(string nic, string fullName, string email, string phone)
        {
            var update = Builders<User>.Update
                .Set(u => u.FullName, fullName)
                .Set(u => u.Email, email)
                .Set(u => u.Phone, phone);

            await _users.UpdateOneAsync(u => u.Nic == nic, update);
        }

        // Flips IsActive to false. Called when a Prosumer deactivates their own account.
        // Any reactivation request or rejection left from a previous cycle is cleared. 
        // Else, a re-deactivated account would re-appear in the Backoffice queue.
        public async Task DeactivateAsync(string nic, string? reason)
        {
            var update = Builders<User>.Update
                .Set(u => u.IsActive, false)
                .Set(u => u.DeactivationReason, reason)
                .Set(u => u.DeactivatedAt, DateTime.UtcNow)
                .Set(u => u.ReactivationRequestedAt, (DateTime?)null)
                .Set(u => u.ReactivationRejectedAt, (DateTime?)null)
                .Set(u => u.ReactivationRejectionReason, (string?)null);

            await _users.UpdateOneAsync(u => u.Nic == nic, update);
        }

        // Flips IsActive back to true. Only ever reached via a Backoffice-only endpoint.
        // Clears the deactivation and reactivation-request fields, so the account looks like it never deactivated.
        public async Task ReactivateAsync(string nic)
        {
            var update = Builders<User>.Update
                .Set(u => u.IsActive, true)
                .Set(u => u.DeactivationReason, (string?)null)
                .Set(u => u.DeactivatedAt, (DateTime?)null)
                .Set(u => u.ReactivationRequestedAt, (DateTime?)null)
                .Set(u => u.ReactivationRejectedAt, (DateTime?)null)
                .Set(u => u.ReactivationRejectionReason, (string?)null);

            await _users.UpdateOneAsync(u => u.Nic == nic, update);
        }

        // Records a deactivated Prosumer's request to be restored.
        // This puts the account into the Backoffice queue. 
        // Any earlier rejection is cleared so a fresh request isn't shown alongside a stale decline.
        public async Task RequestReactivationAsync(string nic)
        {
            var update = Builders<User>.Update
                .Set(u => u.ReactivationRequestedAt, DateTime.UtcNow)
                .Set(u => u.ReactivationRejectedAt, (DateTime?)null)
                .Set(u => u.ReactivationRejectionReason, (string?)null);

            await _users.UpdateOneAsync(u => u.Nic == nic, update);
        }

        // Withdraws an outstanding request. The account stays deactivated. Takes it back out of the Backoffice queue.
        public async Task CancelReactivationRequestAsync(string nic)
        {
            var update = Builders<User>.Update
                .Set(u => u.ReactivationRequestedAt, (DateTime?)null);

            await _users.UpdateOneAsync(u => u.Nic == nic, update);
        }

        // Declines an outstanding request. The account leaves the queue. 
        // The reason is kept so the Prosumer can be told why at their next login attempt.
        public async Task RejectReactivationAsync(string nic, string? reason)
        {
            var update = Builders<User>.Update
                .Set(u => u.ReactivationRequestedAt, (DateTime?)null)
                .Set(u => u.ReactivationRejectedAt, DateTime.UtcNow)
                .Set(u => u.ReactivationRejectionReason, reason);

            await _users.UpdateOneAsync(u => u.Nic == nic, update);
        }

        // Every deactivated Prosumer with an outstanding reactivation request, for the Backoffice queue. 
        // Sorted oldest request first.
        public async Task<List<User>> GetReactivationRequestsAsync()
        {
            return await _users
                .Find(u => u.Role == Roles.Prosumer && !u.IsActive && u.ReactivationRequestedAt != null)
                .SortBy(u => u.ReactivationRequestedAt)
                .ToListAsync();
        }

        // Returns every Prosumer account regardless of status (active and deactivated), for the Backoffice master prosumer directory.
        public async Task<List<User>> GetAllProsumersAsync()
        {
            return await _users.Find(u => u.Role == Roles.Prosumer).ToListAsync();
        }

        // Returns every Backoffice/GridOperator account, for the Backoffice staff-management screen.
        public async Task<List<User>> GetStaffAsync()
        {
            return await _users.Find(u => u.Role == Roles.Backoffice || u.Role == Roles.GridOperator).ToListAsync();
        }

        // Updates the editable contact fields on a staff account, keyed by username.
        // Username and Role are never touched here.
        public async Task UpdateStaffProfileAsync(string username, string fullName, string email, string phone)
        {
            var update = Builders<User>.Update
                .Set(u => u.FullName, fullName)
                .Set(u => u.Email, email)
                .Set(u => u.Phone, phone);

            await _users.UpdateOneAsync(u => u.Username == username, update);
        }

        // Enables or disables a staff account's ability to sign in..
        public async Task SetStaffActiveAsync(string username, bool isActive)
        {
            var update = Builders<User>.Update.Set(u => u.IsActive, isActive);

            await _users.UpdateOneAsync(u => u.Username == username, update);
        }

        // How many Backoffice accounts can currently sign in.
        // Used to stop the last one being deactivated. 
        // ( Reaching zero would leave the system with no way to administer itself. )
        public async Task<long> CountActiveBackofficeAsync()
        {
            return await _users.CountDocumentsAsync(u => u.Role == Roles.Backoffice && u.IsActive);
        }

        // True, if at least one Backoffice account already exists.
        // Used only at startup to decide whether the first Backoffice account needs to be seeded.
        public async Task<bool> AnyBackofficeExistsAsync()
        {
            return await _users.Find(u => u.Role == Roles.Backoffice).AnyAsync();
        }
    }
}
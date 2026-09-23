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

        // Flips IsActive to false. Called when a Prosumer requests deactivation.
        public async Task DeactivateAsync(string nic, string? reason)
        {
            var update = Builders<User>.Update
                .Set(u => u.IsActive, false)
                .Set(u => u.DeactivationReason, reason)
                .Set(u => u.DeactivatedAt, DateTime.UtcNow);

            await _users.UpdateOneAsync(u => u.Nic == nic, update);
        }

        // Flips IsActive back to true. Only ever reached via a Backoffice-only endpoint.
        public async Task ReactivateAsync(string nic)
        {
            var update = Builders<User>.Update
                .Set(u => u.IsActive, true)
                .Set(u => u.DeactivationReason, (string?)null)
                .Set(u => u.DeactivatedAt, (DateTime?)null);

            await _users.UpdateOneAsync(u => u.Nic == nic, update);
        }

        // Returns every deactivated Prosumer account, for the Backoffice review screen.
        public async Task<List<User>> GetPendingDeactivationAsync()
        {
            return await _users.Find(u => u.Role == Roles.Prosumer && !u.IsActive).ToListAsync();
        }
    }
}
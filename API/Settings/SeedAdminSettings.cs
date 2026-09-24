/* File: SeedAdminSettings.cs
 * Purpose: Configuration-bound settings for the one-time startup seed of the first Backoffice account.
 * Author: IT23218512
 */

namespace API.Settings
{
    public class SeedAdminSettings
    {
        public string Username { get; set; } = string.Empty;

        // Plain text in configuration, same as any other startup secret
        // (connection strings, signing keys). Hashed before it's ever
        // written to MongoDB — see Program.cs.
        public string Password { get; set; } = string.Empty;

        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }
}
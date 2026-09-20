/* File: JwtSettings.cs
 * Purpose: Strongly-typed representation of the "JwtSettings" section in appsettings.json.
 * Author: IT23218512
 */

namespace API.Settings
{
    public class JwtSettings
    {
        // Secret used to sign tokens. ( Must be long/random )
        public string SigningKey { get; set; } = string.Empty;

        // Identifies who issued the token (API).
        public string Issuer { get; set; } = string.Empty;

        // Identifies who the token is intended for (clients).
        public string Audience { get; set; } = string.Empty;

        // How long a token stays valid before the client must log in again.
        public int ExpiryMinutes { get; set; } = 120;
    }
}
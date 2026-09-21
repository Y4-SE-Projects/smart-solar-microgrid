/* File: AuthDtos.cs
 * Purpose: Request / response shapes for the register and login endpoints.
 * (Kept separate from User.cs because these describe what the client sends/receives over HTTP, not what's stored in MongoDB.)
 * Author: IT23218512
 */

namespace API.Models
{
    // Body for POST /api/users/register
    public class RegisterRequest
    {
        // One of Roles.Backoffice, Roles.GridOperator, Roles.Prosumer.
        public string Role { get; set; } = string.Empty;

        // Required when Role == Prosumer.
        public string? Nic { get; set; }

        // Required when Role != Prosumer.
        public string? Username { get; set; }

        // Plain text from the client — hashed before it's ever stored.
        public string Password { get; set; } = string.Empty;

        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }

    // Body for POST /api/users/login
    public class LoginRequest
    {
        // NIC for Prosumers, Username for Backoffice/GridOperator.
        public string Identifier { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    // The "data" payload returned on successful login — the one stable shape every client (Web and Mobile) parses the same way.
    public class AuthResponseData
    {
        public string Token { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;

        // Nic or Username
        public string Identifier { get; set; } = string.Empty;

        public string FullName { get; set; } = string.Empty;
    }
}
/* File: AuthDtos.cs
 * Purpose: Request / response shapes for the register and login endpoints.
 * (Kept separate from User.cs because these describe what the client sends/receives over HTTP,
 * not what's stored in MongoDB.)
 * Author: IT23218512
 */

namespace API.DTOs
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

    // Body for PUT /api/users/{nic} — a Prosumer editing their own profile.
    // Nic and Role are deliberately absent: neither can be changed here.
    public class UpdateProfileRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }

    // Body for PUT /api/users/{nic}/deactivate. ( Reason is optional )
    public class DeactivateAccountRequest
    {
        public string? Reason { get; set; }
    }

    // Body for POST /api/users/reactivation-request and its /cancel counterpart.
    // These endpoints are public because a deactivated account is never issued a token. 
    // NIC and password is what authenticates the call, and stops anyone's raising requests against a NIC that isn't theirs.
    public class ReactivationRequest
    {
        public string Nic { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    // Body for PUT /api/users/{nic}/reject-reactivation. ( Reason is optional )
    public class RejectReactivationRequest
    {
        public string? Reason { get; set; }
    }

    // Body for PUT /api/users/staff/{username} — a Backoffice user editing a Backoffice or GridOperator account.
    // Username and Role can not be changed.
    public class UpdateStaffRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }

    // Body for PUT /api/users/staff/{username}/password — Backoffice resetting a staff member's password.
    // ( The account's current password is deliberately not required. )
    public class ResetStaffPasswordRequest
    {
        public string NewPassword { get; set; } = string.Empty;
    }

    // Safe shape returned by profile-related endpoints.
    // Deliberately excludes PasswordHash — that should never leave the server.
    public class UserProfileResponse
    {
        public string Nic { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }

        // One of the AccountStatus values - Active, Deactivated or PendingReactivation.
        // Computed server-side so the Web and Mobile clients don't each re-derive the same three states from the flags below.
        public string Status { get; set; } = string.Empty;

        // Below are only populated when the account is/was deactivated.
        public string? DeactivationReason { get; set; }
        public DateTime? DeactivatedAt { get; set; }

        // Computed server-side from DeactivatedAt
        // The client doesn't need to do its own date math (or worry about timezones).
        public int? DaysElapsed { get; set; }

        // Only populated while a reactivation request is outstanding. 
        // DaysSinceRequest is how long the Backoffice queue has been sitting on it.
        public DateTime? ReactivationRequestedAt { get; set; }
        public int? DaysSinceRequest { get; set; }
    }

    // Safe shape returned by GET /api/users/staff — Backoffice/GridOperator accounts.
    // Username-keyed (not NIC) and has no deactivation-reason fields, since those only apply to Prosumer accounts.
    // Deliberately excludes PasswordHash, same as UserProfileResponse.
    public class StaffProfileResponse
    {
        public string Username { get; set; } = string.Empty;

        // Roles.Backoffice or Roles.GridOperator.
        public string Role { get; set; } = string.Empty;

        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
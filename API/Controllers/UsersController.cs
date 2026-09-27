/* File: UsersController.cs
 * Purpose: User authentication and account-management endpoints.
 * Author: IT23218512
 */

using API.DTOs;
using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UsersController : ControllerBase
    {
        private readonly UserService _userService;
        private readonly JwtTokenService _tokenService;

        // Shortest password the API will store, applied wherever one is set.
        // The rule lives here rather than only in the web form, so it holds for every
        // client and for anything hitting the API directly.
        private const int MinimumPasswordLength = 8;

        // Constructor: DI supplies the shared UserService and JwtTokenService.
        public UsersController(UserService userService, JwtTokenService tokenService)
        {
            _userService = userService;
            _tokenService = tokenService;
        }

        // Registers a new user. ( Prosumers register with NIC; Backoffice/ GridOperator register with Username. )
        // Rejects duplicate NIC/username.
        // Prosumer registration stays public (mobile self-service).
        // Registering a Backoffice or GridOperator account requires an already-authenticated Backoffice caller.
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            var validRoles = new[] { Roles.Backoffice, Roles.GridOperator, Roles.Prosumer };
            if (!validRoles.Contains(request.Role))
            {
                return BadRequest(new { success = false, message = "Role must be Backoffice, GridOperator, or Prosumer." });
            }

            if (string.IsNullOrEmpty(request.Password) || request.Password.Length < MinimumPasswordLength)
            {
                return BadRequest(new { success = false, message = $"Password must be at least {MinimumPasswordLength} characters." });
            }

            // Prosumers are a mobile-only role, so their sign-up belongs to the mobile app.
            var clientType = Request.Headers["X-Client-Type"].FirstOrDefault();

            if (request.Role == Roles.Prosumer && clientType == "Web")
            {
                return Unauthorized(new { success = false, message = "Prosumer accounts must be registered from the mobile app." });
            }

            if (request.Role != Roles.Prosumer)
            {
                if (!(User.Identity?.IsAuthenticated ?? false) || !User.IsInRole(Roles.Backoffice))
                {
                    return Unauthorized(new { success = false, message = "Only a Backoffice user can register Backoffice or Grid Operator accounts." });
                }
            }

            if (request.Role == Roles.Prosumer)
            {
                if (string.IsNullOrWhiteSpace(request.Nic))
                {
                    return BadRequest(new { success = false, message = "NIC is required for Prosumer registration." });
                }

                // NicExistsAsync ignores IsActive on purpose. 
                // A Prosumer who deactivated their account can't start a new one on the same NIC. 
                // Reactivation is the only way back in.
                if (await _userService.NicExistsAsync(request.Nic))
                {
                    return BadRequest(new { success = false, message = "A user with this NIC already exists." });
                }
            }
            else
            {
                if (string.IsNullOrWhiteSpace(request.Username))
                {
                    return BadRequest(new { success = false, message = "Username is required for this role." });
                }
                if (await _userService.UsernameExistsAsync(request.Username))
                {
                    return BadRequest(new { success = false, message = "This username is already taken." });
                }
            }

            var user = new User
            {
                Nic = request.Role == Roles.Prosumer ? request.Nic : null,
                Username = request.Role != Roles.Prosumer ? request.Username : null,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                FullName = request.FullName,
                Email = request.Email,
                Phone = request.Phone,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            await _userService.CreateUserAsync(user);

            return Ok(new { success = true, message = "Registration successful." });
        }

        // Logs a user in with NIC (Prosumer) or Username (Backoffice/GridOperator) plus password, and returns a signed JWT on success.
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _userService.FindByNicAsync(request.Identifier)
                       ?? await _userService.FindByUsernameAsync(request.Identifier);

            // Separate guard clauses so the compiler knows "user" is non-null from this point on.
            if (user == null)
            {
                return Unauthorized(new { success = false, message = "Invalid credentials." });
            }

            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { success = false, message = "Invalid credentials." });
            }

            // Enforce that each role only authenticates through its allowed platform.
            // (Prosumer = Mobile only, Backoffice = Web only, GridOperator = both)
            var clientType = Request.Headers["X-Client-Type"].FirstOrDefault();

            if (user.Role == Roles.Prosumer && clientType == "Web")
            {
                return Unauthorized(new { success = false, message = "Prosumer accounts must use the mobile app." });
            }

            if (user.Role == Roles.Backoffice && clientType == "Mobile")
            {
                return Unauthorized(new { success = false, message = "Backoffice accounts must use the web application." });
            }

            // A deactivated Prosumer is told the state of their account rather than simply refused. 
            // So the mobile app knows whether to offer "Request Reactivation" or to show a request that is already pending. 
            // No token is issued either way.
            if (!user.IsActive)
            {
                if (user.Role == Roles.Prosumer)
                {
                    return Unauthorized(new
                    {
                        success = false,
                        code = "ACCOUNT_DEACTIVATED",
                        reactivationRequested = user.ReactivationRequestedAt.HasValue,
                        rejectionReason = user.ReactivationRejectionReason,
                        message = "This account has been deactivated."
                    });
                }

                // Staff accounts have no self-service route back — only a Backoffice user can restore one.
                return Unauthorized(new { success = false, message = "This account has been deactivated. Contact a Backoffice administrator." });
            }

            var token = _tokenService.GenerateToken(user);

            var data = new AuthResponseData
            {
                Token = token,
                Role = user.Role,
                Identifier = user.Nic ?? user.Username ?? string.Empty,
                FullName = user.FullName
            };

            return Ok(new { success = true, data });
        }

        // Returns a Prosumer's own profile.
        // The role check alone isn't enough here. [Authorize(Roles = Prosumer)] only proves the caller IS a Prosumer, not that they own THIS NIC.
        [Authorize(Roles = Roles.Prosumer)]
        [HttpGet("{nic}")]
        public async Task<IActionResult> GetProfile(string nic)
        {
            var callerNic = User.FindFirstValue("nic");
            if (callerNic != nic)
            {
                return Forbid();
            }

            var user = await _userService.FindByNicAsync(nic);
            if (user == null)
            {
                return NotFound(new { success = false, message = "User not found." });
            }

            return Ok(new { success = true, data = MapToProfileResponse(user) });
        }

        // Updates a Prosumer's own profile fields.
        // Same ownership check as GetProfile because role alone doesn't prove it's their record.
        [Authorize(Roles = Roles.Prosumer)]
        [HttpPut("{nic}")]
        public async Task<IActionResult> UpdateProfile(string nic, [FromBody] UpdateProfileRequest request)
        {
            var callerNic = User.FindFirstValue("nic");
            if (callerNic != nic)
            {
                return Forbid();
            }

            var user = await _userService.FindByNicAsync(nic);
            if (user == null)
            {
                return NotFound(new { success = false, message = "User not found." });
            }

            await _userService.UpdateProfileAsync(nic, request.FullName, request.Email, request.Phone);

            return Ok(new { success = true, message = "Profile updated." });
        }

        // A Prosumer requests deactivation of their own account, optionally stating why (shown to Backoffice on the review screen).
        // Once deactivated, only a Backoffice user can bring it back.
        [Authorize(Roles = Roles.Prosumer)]
        [HttpPut("{nic}/deactivate")]
        public async Task<IActionResult> RequestDeactivation(string nic, [FromBody] DeactivateAccountRequest? request)
        {
            var callerNic = User.FindFirstValue("nic");
            if (callerNic != nic)
            {
                return Forbid();
            }

            var user = await _userService.FindByNicAsync(nic);
            if (user == null)
            {
                return NotFound(new { success = false, message = "User not found." });
            }

            if (!user.IsActive)
            {
                return BadRequest(new { success = false, message = "Account is already deactivated." });
            }

            await _userService.DeactivateAsync(nic, request?.Reason);

            return Ok(new { success = true, message = "Account deactivated. A Backoffice user must reactivate it." });
        }

        // A deactivated Prosumer asks to have their account restored.
        // Public by necessity: login won't issue a token for a deactivated account. 
        // Re-checking the NIC and password authenticates the request, and stops anyone's requests against a NIC that isn't theirs.
        [HttpPost("reactivation-request")]
        public async Task<IActionResult> RequestReactivation([FromBody] ReactivationRequest request)
        {
            var user = await AuthenticateProsumerAsync(request.Nic, request.Password);
            if (user == null)
            {
                return Unauthorized(new { success = false, message = "Invalid credentials." });
            }

            if (user.IsActive)
            {
                return BadRequest(new { success = false, message = "This account is already active." });
            }

            if (user.ReactivationRequestedAt.HasValue)
            {
                return BadRequest(new { success = false, message = "A reactivation request is already pending." });
            }

            await _userService.RequestReactivationAsync(user.Nic!);

            return Ok(new { success = true, message = "Reactivation request sent. A Backoffice user will review it." });
        }

        // Withdraws a pending reactivation request. 
        // The account stays deactivated and takes it out of the Backoffice queue.
        // ( Public for the same reason as the request endpoint above. )
        [HttpPost("reactivation-request/cancel")]
        public async Task<IActionResult> CancelReactivationRequest([FromBody] ReactivationRequest request)
        {
            var user = await AuthenticateProsumerAsync(request.Nic, request.Password);
            if (user == null)
            {
                return Unauthorized(new { success = false, message = "Invalid credentials." });
            }

            if (!user.ReactivationRequestedAt.HasValue)
            {
                return BadRequest(new { success = false, message = "There is no pending reactivation request to cancel." });
            }

            await _userService.CancelReactivationRequestAsync(user.Nic!);

            return Ok(new { success = true, message = "Reactivation request cancelled." });
        }

        // Restores a deactivated Prosumer account. ( Backoffice only )
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("{nic}/reactivate")]
        public async Task<IActionResult> Reactivate(string nic)
        {
            var user = await _userService.FindByNicAsync(nic);
            if (user == null)
            {
                return NotFound(new { success = false, message = "User not found." });
            }

            if (user.IsActive)
            {
                return BadRequest(new { success = false, message = "Account is already active." });
            }

            await _userService.ReactivateAsync(nic);

            return Ok(new { success = true, message = "Account reactivated." });
        }

        // Declines a pending reactivation request. ( Backoffice only )
        // The account stays deactivated and leaves the queue.
        // The reason is kept so the Prosumer is told why the next time they try to log in.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("{nic}/reject-reactivation")]
        public async Task<IActionResult> RejectReactivation(string nic, [FromBody] RejectReactivationRequest? request)
        {
            var user = await _userService.FindByNicAsync(nic);
            if (user == null)
            {
                return NotFound(new { success = false, message = "User not found." });
            }

            if (!user.ReactivationRequestedAt.HasValue)
            {
                return BadRequest(new { success = false, message = "There is no pending reactivation request to reject." });
            }

            await _userService.RejectReactivationAsync(nic, request?.Reason);

            return Ok(new { success = true, message = "Reactivation request rejected." });
        }

        // Lists the deactivated Prosumer accounts that asked restore, for the Backoffice queue. 
        // Oldest request first.
        // Only appears here once its owner actually requests reactivation.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpGet("reactivation-requests")]
        public async Task<IActionResult> GetReactivationRequests()
        {
            var requests = await _userService.GetReactivationRequestsAsync();
            var data = requests.Select(MapToProfileResponse);

            return Ok(new { success = true, data });
        }

        // Lists every Prosumer account regardless of status (active and deactivated) for the Backoffice master directory.
        // Separate from GetReactivationRequests, which only returns accounts currently awaiting Backoffice action.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpGet("prosumers")]
        public async Task<IActionResult> GetProsumers()
        {
            var prosumers = await _userService.GetAllProsumersAsync();
            var data = prosumers.Select(MapToProfileResponse);

            return Ok(new { success = true, data });
        }

        // Lists every Backoffice/GridOperator account for the Backoffice staff-management screen.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpGet("staff")]
        public async Task<IActionResult> GetStaff()
        {
            var staff = await _userService.GetStaffAsync();
            var data = staff.Select(MapToStaffResponse);

            return Ok(new { success = true, data });
        }

        // Updates a staff member's contact details. ( Backoffice only )
        // Username and Role aren't editable here.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("staff/{username}")]
        public async Task<IActionResult> UpdateStaff(string username, [FromBody] UpdateStaffRequest request)
        {
            var user = await _userService.FindByUsernameAsync(username);
            if (user == null || user.Role == Roles.Prosumer)
            {
                return NotFound(new { success = false, message = "Staff account not found." });
            }

            await _userService.UpdateStaffProfileAsync(username, request.FullName, request.Email, request.Phone);

            return Ok(new { success = true, message = "Staff account updated." });
        }

        // Switches off a staff account's access. ( Backoffice only )
        // Deactivating rather than deleting keeps the account's history intact.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("staff/{username}/deactivate")]
        public async Task<IActionResult> DeactivateStaff(string username)
        {
            var user = await _userService.FindByUsernameAsync(username);
            if (user == null || user.Role == Roles.Prosumer)
            {
                return NotFound(new { success = false, message = "Staff account not found." });
            }

            if (!user.IsActive)
            {
                return BadRequest(new { success = false, message = "This account is already deactivated." });
            }

            // Locking yourself out mid-session helps nobody, and the account would then need another Backoffice user to restore it.
            var callerUsername = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.Equals(callerUsername, username, StringComparison.Ordinal))
            {
                return BadRequest(new { success = false, message = "You cannot deactivate your own account." });
            }

            // Deactivating the last active Backoffice account one would leave nobody able to administer the system.
            if (user.Role == Roles.Backoffice && await _userService.CountActiveBackofficeAsync() <= 1)
            {
                return BadRequest(new { success = false, message = "This is the last active Backoffice account and cannot be deactivated." });
            }

            await _userService.SetStaffActiveAsync(username, false);

            return Ok(new { success = true, message = "Staff account deactivated." });
        }

        // Resets a staff member's password. ( Backoffice only )
        // The existing password isn't required — an administrator resetting a forgotten
        // password has no way of knowing it. This is why the endpoint is Backoffice-gated
        // and why it only reaches staff accounts.
        //
        // Note the reset doesn't end any session the account already has: tokens are
        // stateless, so one issued before the change stays valid until it expires.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("staff/{username}/password")]
        public async Task<IActionResult> ResetStaffPassword(string username, [FromBody] ResetStaffPasswordRequest request)
        {
            var user = await _userService.FindByUsernameAsync(username);
            if (user == null || user.Role == Roles.Prosumer)
            {
                return NotFound(new { success = false, message = "Staff account not found." });
            }

            if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < MinimumPasswordLength)
            {
                return BadRequest(new { success = false, message = $"Password must be at least {MinimumPasswordLength} characters." });
            }

            await _userService.SetStaffPasswordAsync(username, BCrypt.Net.BCrypt.HashPassword(request.NewPassword));

            return Ok(new { success = true, message = "Password reset. Share the new password with the account holder." });
        }

        // Restores a deactivated staff account. ( Backoffice only )
        // Separate from the Prosumer reactivate endpoint, which is keyed by NIC.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("staff/{username}/reactivate")]
        public async Task<IActionResult> ReactivateStaff(string username)
        {
            var user = await _userService.FindByUsernameAsync(username);
            if (user == null || user.Role == Roles.Prosumer)
            {
                return NotFound(new { success = false, message = "Staff account not found." });
            }

            if (user.IsActive)
            {
                return BadRequest(new { success = false, message = "This account is already active." });
            }

            await _userService.SetStaffActiveAsync(username, true);

            return Ok(new { success = true, message = "Staff account reactivated." });
        }

        // Verifies a NIC and password for the two public reactivation endpoints.
        // Returns null when the NIC is unknown, the password is wrong, or the account isn't a Prosumer. 
        private async Task<User?> AuthenticateProsumerAsync(string nic, string password)
        {
            if (string.IsNullOrWhiteSpace(nic) || string.IsNullOrEmpty(password))
            {
                return null;
            }

            var user = await _userService.FindByNicAsync(nic);
            if (user == null || user.Role != Roles.Prosumer)
            {
                return null;
            }

            return BCrypt.Net.BCrypt.Verify(password, user.PasswordHash) ? user : null;
        }

        // Shared mapping from the stored User document to the safe response shape.
        // DaysElapsed figure computed from DeactivatedAt.
        // Used for Prosumer accounts (NIC-keyed).
        private static UserProfileResponse MapToProfileResponse(User user)
        {
            return new UserProfileResponse
            {
                Nic = user.Nic ?? string.Empty,
                FullName = user.FullName,
                Email = user.Email,
                Phone = user.Phone,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt,
                Status = ResolveStatus(user),
                DeactivationReason = user.DeactivationReason,
                DeactivatedAt = user.DeactivatedAt,
                DaysElapsed = user.DeactivatedAt.HasValue
                    ? (int)(DateTime.UtcNow - user.DeactivatedAt.Value).TotalDays
                    : null,
                ReactivationRequestedAt = user.ReactivationRequestedAt,
                DaysSinceRequest = user.ReactivationRequestedAt.HasValue
                    ? (int)(DateTime.UtcNow - user.ReactivationRequestedAt.Value).TotalDays
                    : null
            };
        }

        // Collapses IsActive and ReactivationRequestedAt into the single status value both clients display, so neither of them re-implements this rule.
        private static string ResolveStatus(User user)
        {
            if (user.IsActive)
            {
                return AccountStatus.Active;
            }

            return user.ReactivationRequestedAt.HasValue
                ? AccountStatus.PendingReactivation
                : AccountStatus.Deactivated;
        }

        // Safe mapping for Backoffice/GridOperator accounts.
        // (Username-keyed, no NIC/deactivation-reason fields since those are Prosumer-specific).
        private static StaffProfileResponse MapToStaffResponse(User user)
        {
            return new StaffProfileResponse
            {
                Username = user.Username ?? string.Empty,
                Role = user.Role,
                FullName = user.FullName,
                Email = user.Email,
                Phone = user.Phone,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt
            };
        }
    }
}
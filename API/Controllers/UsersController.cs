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

            if (!user.IsActive)
            {
                return Unauthorized(new { success = false, message = "This account has been deactivated." });
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
        // Same ownership check as GetProfile because role alone doesn't prove it's THEIR record.
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

        // Lists every deactivated Prosumer account for Backoffice review.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpGet("pending-deactivation")]
        public async Task<IActionResult> GetPendingDeactivation()
        {
            var pendingUsers = await _userService.GetPendingDeactivationAsync();
            var data = pendingUsers.Select(MapToProfileResponse);

            return Ok(new { success = true, data });
        }

        // Lists every Prosumer account regardless of status (active and deactivated) for the Backoffice master directory. 
        // Separate from GetPendingDeactivation, which only returns accounts currently awaiting Backoffice action.
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
                DeactivationReason = user.DeactivationReason,
                DeactivatedAt = user.DeactivatedAt,
                DaysElapsed = user.DeactivatedAt.HasValue
                    ? (int)(DateTime.UtcNow - user.DeactivatedAt.Value).TotalDays
                    : null
            };
        }

        // Safe mapping for Backoffice/GridOperator accounts 
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
/*
 * File: UsersController.cs
 * Purpose: User authentication and account-management endpoints — register,
 *          login, profile view/edit, deactivation request, Backoffice
 *          reactivation, and the pending-deactivation review list.
 * Author: <your name / IT number>
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

        // Registers a new user. Prosumers register with NIC; Backoffice/
        // GridOperator register with Username. Rejects duplicate NIC/username.
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            var validRoles = new[] { Roles.Backoffice, Roles.GridOperator, Roles.Prosumer };
            if (!validRoles.Contains(request.Role))
            {
                return BadRequest(new { success = false, message = "Role must be Backoffice, GridOperator, or Prosumer." });
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

        // Logs a user in with NIC (Prosumer) or Username (Backoffice/GridOperator)
        // plus password, and returns a signed JWT on success.
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _userService.FindByNicAsync(request.Identifier)
                       ?? await _userService.FindByUsernameAsync(request.Identifier);

            // Separate guard clauses (rather than one combined condition) so the
            // compiler — and anyone reading this — knows "user" is non-null from
            // this point on. Both failure cases return the same generic message
            // on purpose: it shouldn't be possible to tell from the outside
            // whether a login failed because the account doesn't exist or
            // because the password was wrong.
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

        // Returns a Prosumer's own profile. The role check alone isn't
        // enough here — [Authorize(Roles = Prosumer)] only proves the
        // caller IS a Prosumer, not that they own THIS NIC. The extra
        // check against the "nic" claim on their own token stops one
        // Prosumer from reading another's profile by editing the URL.
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

        // Updates a Prosumer's own profile fields. Same ownership check as
        // GetProfile — role alone doesn't prove it's THEIR record.
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

        // A Prosumer requests deactivation of their own account, optionally
        // stating why (shown to Backoffice on the review screen). Once
        // deactivated, only a Backoffice user can bring it back — that
        // reactivation endpoint is deliberately separate and role-gated.
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

        // Restores a deactivated Prosumer account. Backoffice only — this
        // is the one business rule the assignment states explicitly.
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
        // Note: this literal route ("pending-deactivation") and the
        // parameterised "{nic}" route above don't actually conflict —
        // ASP.NET Core's routing always prefers a literal segment match
        // over a parameter match, regardless of which is declared first.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpGet("pending-deactivation")]
        public async Task<IActionResult> GetPendingDeactivation()
        {
            var pendingUsers = await _userService.GetPendingDeactivationAsync();
            var data = pendingUsers.Select(MapToProfileResponse);

            return Ok(new { success = true, data });
        }

        // Shared mapping from the stored User document to the safe response
        // shape, including the DaysElapsed figure computed from
        // DeactivatedAt so neither client has to do its own date math.
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
    }
}
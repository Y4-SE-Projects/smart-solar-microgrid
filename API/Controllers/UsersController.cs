/* File: UsersController.cs
 * Purpose: Minimal authentication endpoints.
 * Author: IT23218512
 */

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

        // Registers a new user. Prosumers register with NIC; Backoffice / GridOperator register with Username. 
        // Rejects duplicate NIC/username.
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

        // Logs a user in with NIC (Prosumer) or Username (Backoffice/GridOperator) plus password, and returns a signed JWT on success.
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _userService.FindByNicAsync(request.Identifier)
                       ?? await _userService.FindByUsernameAsync(request.Identifier);

            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
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

        // Returns a Prosumer's own profile. 
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

            var profile = new UserProfileResponse
            {
                Nic = user.Nic ?? string.Empty,
                FullName = user.FullName,
                Email = user.Email,
                Phone = user.Phone,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt
            };

            return Ok(new { success = true, data = profile });
        }

        // Updates a Prosumer's own profile fields. 
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

        // A Prosumer requests deactivation of their own account. 
        // (Once deactivated, only a Backoffice user can bring it back)
        [Authorize(Roles = Roles.Prosumer)]
        [HttpPut("{nic}/deactivate")]
        public async Task<IActionResult> RequestDeactivation(string nic)
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

            await _userService.DeactivateAsync(nic);

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

            var data = pendingUsers.Select(u => new UserProfileResponse
            {
                Nic = u.Nic ?? string.Empty,
                FullName = u.FullName,
                Email = u.Email,
                Phone = u.Phone,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            });

            return Ok(new { success = true, data });
        }
    }
}
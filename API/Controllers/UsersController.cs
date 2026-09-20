/*
 * File: UsersController.cs
 * Purpose: Minimal authentication endpoints — register and login — so the
 *          team can obtain real JWT tokens for Swagger/Postman testing.
 *          Profile, deactivation, and reactivation endpoints (the rest of
 *          Member 1's scope) come in a later pass.
 * Author: <your name / IT number>
 */
using API.Models;
using API.Services;
using Microsoft.AspNetCore.Mvc;

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
    }
}
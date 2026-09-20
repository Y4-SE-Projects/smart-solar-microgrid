/*
 * File: JwtTokenService.cs
 * Purpose: Builds signed JWTs at login time. Every token carries the
 *          user's role (for [Authorize(Roles = ...)] checks) and, for
 *          Prosumers specifically, a dedicated "nic" claim so reservation
 *          endpoints can confirm ownership without a second DB lookup.
 * Author: <your name / IT number>
 */
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using API.Models;
using API.Settings;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace API.Services
{
    public class JwtTokenService
    {
        private readonly JwtSettings _settings;

        // Constructor: captures the bound JWT settings (key/issuer/audience/expiry).
        public JwtTokenService(IOptions<JwtSettings> settings)
        {
            _settings = settings.Value;
        }

        // Builds a signed token for the given user. NameIdentifier holds the
        // NIC (Prosumer) or Username (Backoffice/GridOperator) — whichever
        // the user actually has. A separate "nic" claim is added only when
        // the user has one.
        public string GenerateToken(User user)
        {
            var identifier = user.Nic ?? user.Username ?? string.Empty;

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, identifier),
                new Claim(ClaimTypes.Role, user.Role)
            };

            if (!string.IsNullOrEmpty(user.Nic))
            {
                claims.Add(new Claim("nic", user.Nic));
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SigningKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _settings.Issuer,
                audience: _settings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_settings.ExpiryMinutes),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
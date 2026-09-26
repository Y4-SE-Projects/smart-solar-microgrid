/*
* File: QrController.cs
* Purpose: HTTP endpoints for reservation QR retrieval, regeneration, verification, status, revocation and audit.
*/

using System.Security.Claims;
using API.DTOs;
using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers
{
    [ApiController]
    [Route("api/reservations")]
    public class QrController : ControllerBase
    {
        private readonly QrReservationService _service;

        public QrController(QrReservationService service)
        {
            _service = service;
        }

        [Authorize(Roles = Roles.Prosumer)]
        [HttpGet("{id}/qr")]
        public Task<IActionResult> GetQr(string id)
        {
            return RunWithProsumerNicAsync(async nic =>
            {
                var qr = await _service.GetQrForProsumerAsync(id, nic);
                return Ok(new { success = true, data = qr });
            });
        }

        [Authorize(Roles = Roles.Prosumer)]
        [HttpPut("{id}/regenerate-qr")]
        public Task<IActionResult> RegenerateQr(string id)
        {
            return RunWithProsumerNicAsync(async nic =>
            {
                var qr = await _service.RegenerateQrAsync(id, nic);
                return Ok(new { success = true, message = "QR regenerated successfully.", data = qr });
            });
        }

        [Authorize(Roles = Roles.GridOperator)]
        [EnableRateLimiting("qr-verify")]
        [HttpPost("verify-qr")]
        public Task<IActionResult> VerifyQr([FromBody] VerifyQrRequest? request)
        {
            return RunAsync(async () =>
            {
                // Operator identity comes from the JWT, never from the request body
                var operatorId = User.FindFirstValue(ClaimTypes.NameIdentifier);

                if (string.IsNullOrWhiteSpace(operatorId))
                {
                    return Error(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "The authenticated operator is missing.");
                }

                var result = await _service.VerifyAsync(request?.QrCodeData, operatorId);

                return Ok(new
                {
                    success = true,
                    message = result.AlreadyProcessed
                        ? "This QR was already verified by you."
                        : "QR verified and energy transfer completed.",
                    data = result
                });
            });
        }

        [Authorize(Roles = Roles.GridOperator + "," + Roles.Backoffice)]
        [HttpGet("{id}/qr-status")]
        public Task<IActionResult> GetQrStatus(string id)
        {
            return RunAsync(async () =>
                Ok(new { success = true, data = await _service.GetStatusAsync(id) }));
        }

        [Authorize(Roles = Roles.GridOperator + "," + Roles.Backoffice)]
        [HttpPut("{id}/revoke-qr")]
        public Task<IActionResult> RevokeQr(string id)
        {
            return RunAsync(async () =>
            {
                await _service.RevokeQrAsync(id);
                return Ok(new { success = true, message = "QR revoked successfully." });
            });
        }

        [Authorize(Roles = Roles.GridOperator + "," + Roles.Backoffice)]
        [HttpGet("{id}/qr-audit")]
        public Task<IActionResult> GetQrAudit(string id)
        {
            return RunAsync(async () =>
                Ok(new { success = true, data = await _service.GetAuditAsync(id) }));
        }

        [Authorize(Roles = Roles.GridOperator)]
        [HttpGet("qr-scans/recent")]
        public Task<IActionResult> GetRecentScans()
        {
            return RunAsync(async () =>
            {
                var operatorId = User.FindFirstValue(ClaimTypes.NameIdentifier);

                if (string.IsNullOrWhiteSpace(operatorId))
                {
                    return Error(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "The authenticated operator is missing.");
                }

                return Ok(new { success = true, data = await _service.GetRecentScansAsync(operatorId) });
            });
        }

        // Resolves the authenticated Prosumer NIC from the JWT before running the action.
        private Task<IActionResult> RunWithProsumerNicAsync(Func<string, Task<IActionResult>> action)
        {
            return RunAsync(async () =>
            {
                var nic = User.FindFirst("nic")?.Value?.Trim();

                if (string.IsNullOrWhiteSpace(nic))
                {
                    return Error(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "The authenticated Prosumer NIC is missing.");
                }

                return await action(nic);
            });
        }

        // Maps QR application errors to the standard { success, code, message } response.
        private async Task<IActionResult> RunAsync(Func<Task<IActionResult>> action)
        {
            try
            {
                return await action();
            }
            catch (QrOperationException ex)
            {
                return Error(ex.StatusCode, ex.Code, ex.Message);
            }
            catch (Exception)
            {
                return Error(StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "The QR operation failed.");
            }
        }

        private IActionResult Error(int statusCode, string code, string message)
        {
            return StatusCode(statusCode, new { success = false, code, message });
        }
    }
}

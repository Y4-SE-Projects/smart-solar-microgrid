using API.Services;
using API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using API.DTOs;

namespace API.Controllers
{
    [ApiController]
    [Route("api/reservations")]
    public class ReservationOperationsController : ControllerBase
    {
        private readonly ReservationOperationsService _service;

        public ReservationOperationsController(ReservationOperationsService service)
        {
            // Stores the injected service; this controller only handles HTTP concerns
            _service = service;
        }

        [Authorize(Roles = Roles.Prosumer + "," + Roles.GridOperator)]
        [HttpPost]
        public async Task<IActionResult> CreateReservation([FromBody] CreateReservationRequest? request)
        {
            
            if (request == null)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Reservation request is required."
                });
            }

            string effectiveProsumerNic;

            if (User.IsInRole(Roles.Prosumer))
            {
                var authenticatedNic = User.FindFirst("nic")?.Value;

                if (string.IsNullOrWhiteSpace(authenticatedNic))
                {
                    return Unauthorized(new
                    {
                        success = false,
                        message = "The authenticated Prosumer NIC is missing."
                    });
                }

                var suppliedNic = request.ProsumerNic?.Trim();

                if (!string.IsNullOrWhiteSpace(suppliedNic) &&
                    !string.Equals(
                        suppliedNic,
                        authenticatedNic,
                        StringComparison.Ordinal))
                {
                    return StatusCode(
                        StatusCodes.Status403Forbidden,
                        new
                        {
                            success = false,
                            message = "A prosumer cannot create a reservarion for another Prosumer."
                        }); 
                }

                effectiveProsumerNic = authenticatedNic.Trim();
            }
            else if (User.IsInRole(Roles.GridOperator))
            {
                if (string.IsNullOrWhiteSpace(request.ProsumerNic))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Prosumer NIC is required when a GridOperator creates a reservation."
                    });
                }

                effectiveProsumerNic = request.ProsumerNic.Trim();
            }
            else
            {
                return StatusCode(
                    StatusCodes.Status403Forbidden,
                    new
                    {
                        success = false,
                        message = "This user is not authorized to create reservation."
                    }
                );
            }

            try
            {
                var reservarion = await _service.CreateReservationAsync(request, effectiveProsumerNic);

                return StatusCode(
                    StatusCodes.Status201Created,
                    new
                    {
                        success = true,
                        message = "Reservation created successfully.",
                        data = reservarion
                    });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (Exception)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new
                    {
                        success = false,
                        message = "Reservation creation failed."
                    });
            }
        }

        [HttpGet("prosumer/{nic}")]
        public async Task<IActionResult> GetProsumerHistory(string nic)
        {
            // Validates the NIC, gets the history from the service and wraps it in the standard response shape
            if (string.IsNullOrWhiteSpace(nic))
            {
                return BadRequest(new { success = false, message = "NIC is required." });
            }

            var reservations = await _service.GetProsumerHistoryAsync(nic);
            return Ok(new { success = true, data = reservations });
        }

        [HttpGet("prosumer/{nic}/pending")]
        public async Task<IActionResult> GetPendingReservations(string nic)
        {
            if (string.IsNullOrWhiteSpace(nic))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "NIC is required."
                });
            }

            var reservations =
                await _service.GetPendingReservationAsync(nic);

            return Ok(new
            {
                success = true,
                data = reservations
            });
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateReservationStatus(
            string id,
            [FromBody] EnergyReservation request)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Reservation ID is required."
                });
            }

            if (request == null || string.IsNullOrWhiteSpace(request.Status))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "A new reservation status is required."
                });
            }

            try
            {
                var reservation =
                    await _service.UpdateReservationStatusAsync(
                        id,
                        request.Status);

                if (reservation == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Reservation not found."
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Reservation status updated successfully.",
                    data = reservation
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }
    }
}

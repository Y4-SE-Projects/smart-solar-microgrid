/*
* File: ReservationOperationsController.cs
* Purpose: Handles reservation lifecycle and operational HTTP requests.
*/

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

        [Authorize(Roles = Roles.Prosumer + ", " + Roles.GridOperator)]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateReservation(string id, [FromBody] UpdateReservationRequest ? request)
        {
            // Resolves the authenticated actor and delefates the protected update to the service
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Reservation ID is required."
                });
            }

            if (request == null)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Reservation update request is required."
                });
            }

            string? authenticatedProsumerNic = null;
            var isGridOperator = User.IsInRole(Roles.GridOperator);

            if (User.IsInRole(Roles.Prosumer))
            {
                authenticatedProsumerNic = User.FindFirst("nic")?.Value;

                if (string.IsNullOrWhiteSpace(authenticatedProsumerNic))
                {
                    return Unauthorized(new
                    {
                        success = false,
                        message = "The authenticated Prosumer NIC is missing."
                    });
                }

                authenticatedProsumerNic = authenticatedProsumerNic.Trim();
            }
            else if (!isGridOperator)
            {
                return StatusCode(
                    StatusCodes.Status403Forbidden,
                    new
                    {
                        success = false,
                        message = "This role is not authorized to update reservations."
                    }
                );
            }

            try
            {
                var reservation = await _service.UpdateReservationAsync(
                    id.Trim(),
                    request,
                    authenticatedProsumerNic,
                    isGridOperator
                );

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
                    message = "Reservation updated successfully.",
                    data = reservation
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(
                    StatusCodes.Status403Forbidden,
                    new
                    {
                        success = false,
                        message = ex.Message
                    }
                );
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
                        message = "Reservation update failed."
                    }
                );
            }
        }

        [Authorize(Roles = Roles.Prosumer + "," + Roles.GridOperator)]
        [HttpPut("{id}/cancel")]
        public async Task<IActionResult> CancelReservation(string id)
        {
            // Resolves the authenticated actor and delegates the protected cancellation to the service
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Reservation ID is required."
                });
            }

            string? authenticatedProsumerNic = null;
            var isGridOperator = User.IsInRole(Roles.GridOperator);

            if (User.IsInRole(Roles.Prosumer))
            {
                authenticatedProsumerNic = User.FindFirst("nic")?.Value;

                if (string.IsNullOrWhiteSpace(authenticatedProsumerNic))
                {
                    return Unauthorized(new
                    {
                        success = false,
                        message = "The authenticated Prosumer NIC is missing."
                    });
                }

                authenticatedProsumerNic = authenticatedProsumerNic.Trim();
            }
            else if (!isGridOperator)
            {
                return StatusCode(
                    StatusCodes.Status403Forbidden,
                    new
                    {
                        success = false,
                        message = "This role is not authorized to cancel reservations."
                    });
            }

            try
            {
                var reservation = await _service.CancelReservationAsync(
                    id.Trim(),
                    authenticatedProsumerNic,
                    isGridOperator);

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
                    message = "Reservation cancelled successfully.",
                    data = reservation
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(
                    StatusCodes.Status403Forbidden,
                    new
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
                        message = "Reservation cancellation failed."
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

        [Authorize(Roles = Roles.Prosumer)]
        [HttpGet("prosumer/{nic}/pending")]
        public async Task<IActionResult> GetPendingReservations(string nic)
        {
            // Returns pending reservations only when the authenticated Prosumer owns the requested NIC
            if (string.IsNullOrWhiteSpace(nic))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "NIC is required."
                });
            }

            var requestedNic = nic.Trim();
            var authenticatedNic = User.FindFirst("nic")?.Value.Trim();

            if (string.IsNullOrWhiteSpace(authenticatedNic))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "The authenticated Prosumer NIC is missing."
                });
            }

            if (!string.Equals(authenticatedNic, requestedNic, StringComparison.Ordinal))
            {
                return StatusCode(
                    StatusCodes.Status403Forbidden,
                    new
                    {
                        success = false,
                        message = "A Prosumer may view only their own pending reservations."
                    }
                );   
            }

            var reservations =
                await _service.GetPendingReservationAsync(authenticatedNic);

            return Ok(new
            {
                success = true,
                data = reservations
            });
        }

        [Authorize(Roles = Roles.Prosumer)]
        [HttpGet("prosumer/{nic}/dashboard-counts")]
        public async Task<IActionResult> GetDashboardCounts(string nic)
        {
            // Returns dashboard counts only when the authenticated Prosumer owns the requested NIC
            if (string.IsNullOrWhiteSpace(nic))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "NIC is required."
                });
            }

            var requestedNic = nic.Trim();
            var authenticatedNic = User.FindFirst("nic")?.Value?.Trim();

            if (string.IsNullOrWhiteSpace(authenticatedNic))
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "The authenticated Prosumer NIC is missing."
                });
            }

            if (!string.Equals(
                    authenticatedNic,
                    requestedNic,
                    StringComparison.Ordinal))
            {
                return StatusCode(
                    StatusCodes.Status403Forbidden,
                    new
                    {
                        success = false,
                        message = "A Prosumer may view only their own dashboard counts."
                    });
            }

            var counts =
                await _service.GetDashboardCountsAsync(authenticatedNic);

            return Ok(new
            {
                pendingCount = counts.PendingCount,
                approvedFutureCount = counts.ApprovedFutureCount
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

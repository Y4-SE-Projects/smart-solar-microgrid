using API.Services;
using API.Models;
using Microsoft.AspNetCore.Mvc;

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

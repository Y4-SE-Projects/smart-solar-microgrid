// File: SlotsController.cs
// Purpose: Individual HTTP endpoints for station slots.
// Author: IT23215856

using API.DTOs;
using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [ApiController]
    [Route("api/slots")]
    public class SlotsController : ControllerBase
    {
        private readonly SlotService _service;

        public SlotsController(SlotService service)
        {
            // Stores the injected service; this controller only handles HTTP concerns
            _service = service;
        }

        // Update a slot's time window. (Backoffice only)
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("{slotId}")]
        public async Task<IActionResult> UpdateSlot(string slotId, [FromBody] UpdateSlotRequest request)
        {
            if (string.IsNullOrWhiteSpace(slotId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Slot ID is required."
                });
            }

            if (request == null)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "A slot request body is required."
                });
            }

            try
            {
                var slot = await _service.UpdateSlotAsync(slotId, request);

                if (slot == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = $"No slot found with ID '{slotId}'."
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Slot updated successfully.",
                    data = slot
                });
            }
            catch (ArgumentException ex)
            {
                // Missing timezone, or inverted time window
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                // Blocked by an active reservation, or a duplicate start time on the same station
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // Flip a slot's availability. (Grid Operator only)
        [Authorize(Roles = Roles.GridOperator)]
        [HttpPut("{slotId}/availability")]
        public async Task<IActionResult> SetSlotAvailability(string slotId, [FromBody] SetSlotAvailabilityRequest request)
        {
            if (string.IsNullOrWhiteSpace(slotId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Slot ID is required."
                });
            }

            if (request == null)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "An availability request body is required."
                });
            }

            try
            {
                var slot = await _service.SetSlotAvailabilityAsync(slotId, request.IsAvailable);

                if (slot == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = $"No slot found with ID '{slotId}'."
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = slot.IsAvailable ? "Slot marked available." : "Slot marked unavailable.",
                    data = slot
                });
            }
            catch (InvalidOperationException ex)
            {
                // Blocked by an active reservation
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // Permanently delets a slot. (Backoffice only)
        [Authorize(Roles = Roles.Backoffice)]
        [HttpDelete("{slotId}")]
        public async Task<IActionResult> DeleteSlot(string slotId)
        {
            if (string.IsNullOrWhiteSpace(slotId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Slot ID is required."
                });
            }

            try
            {
                var slot = await _service.DeleteSlotAsync(slotId);

                if (slot == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = $"No slot found with ID '{slotId}'."
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Slot deleted successfully.",
                    data = slot
                });
            }
            catch (InvalidOperationException ex)
            {
                // Blocked because a reservation still references this slot
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }
    }
}

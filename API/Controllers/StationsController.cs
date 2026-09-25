// File: StationsController.cs
// Purpose: HTTP endpoints for microgrid station management.
// Author: IT23215856

using System.Globalization;
using API.DTOs;
using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [ApiController]
    [Route("api/stations")]
    public class StationsController : ControllerBase
    {
        private readonly StationService _service;
        private readonly SlotService _slotService;

        public StationsController(StationService service, SlotService slotService)
        {
            // Stores the injected services, this controller only handles HTTP concerns
            _service = service;
            _slotService = slotService;
        }

        // Creates a new microgrid station. (Backoffice only)
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPost]
        public async Task<IActionResult> CreateStation([FromBody] CreateStationRequest request)
        {
            // Rejects if the body is missing, before calling the service
            if (request == null)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "A station request body is required."
                });
            }

            try
            {
                // Hands all validation and business rules to the service
                var station = await _service.CreateStationAsync(request);

                return Ok(new
                {
                    success = true,
                    message = "Station created successfully.",
                    data = station
                });
            }
            catch (ArgumentException ex)
            {
                // Invalid input, e.g. missing fields or GPS coordinates out of range
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                // Conflict, e.g. a station with this ID already exists
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // Lists stations for any authenticated user. Pass activeOnly=true to exclude deactivated stations.
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetStations([FromQuery] bool activeOnly = false)
        {
            // Hands the actual query to the service
            var stations = await _service.GetAllStationsAsync(activeOnly);

            return Ok(new
            {
                success = true,
                data = stations
            });
        }

        // List stations closer to your current location.
        [Authorize]
        [HttpGet("nearby")]
        public async Task<IActionResult> GetNearbyStations([FromQuery] double lat, [FromQuery] double lng, [FromQuery] double radiusKm)
        {
            try
            {
                var stations = await _service.GetNearbyStationsAsync(lat, lng, radiusKm);

                return Ok(new
                {
                    success = true,
                    data = stations
                });
            }
            catch (ArgumentException ex)
            {
                // Invalid lat/lng/radiusKm
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // Deactivate a station. (Backoffice only)
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("{stationId}/deactivate")]
        public async Task<IActionResult> DeactivateStation(string stationId)
        {
            if (string.IsNullOrWhiteSpace(stationId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Station ID is required."
                });
            }

            try
            {
                var station = await _service.DeactivateStationAsync(stationId);

                // Service returned null, meaning no station with this ID exists
                if (station == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = $"No station found with ID '{stationId}'."
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Station deactivated successfully.",
                    data = station
                });
            }
            catch (InvalidOperationException ex)
            {
                // Already deactivated, or blocked by active reservations, both are conflicts with the station's current state
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // Reactivate a station. (Backoffice only)
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("{stationId}/reactivate")]
        public async Task<IActionResult> ReactivateStation(string stationId)
        {
            if (string.IsNullOrWhiteSpace(stationId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Station ID is required."
                });
            }

            try
            {
                var station = await _service.ReactivateStationAsync(stationId);

                if (station == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = $"No station found with ID '{stationId}'."
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Station reactivated successfully.",
                    data = station
                });
            }
            catch (InvalidOperationException ex)
            {
                // Already active
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // Update a station's data. (Backoffice only)
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPut("{stationId}")]
        public async Task<IActionResult> UpdateStation(string stationId, [FromBody] UpdateStationRequest request)
        {
            if (string.IsNullOrWhiteSpace(stationId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Station ID is required."
                });
            }

            if (request == null)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "A station request body is required."
                });
            }

            try
            {
                var station = await _service.UpdateStationAsync(stationId, request);

                if (station == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = $"No station found with ID '{stationId}'."
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Station updated successfully.",
                    data = station
                });
            }
            catch (ArgumentException ex)
            {
                // Invalid input, e.g. GPS coordinates out of range
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // Permanently removes a station. (Backoffice only)
        [Authorize(Roles = Roles.Backoffice)]
        [HttpDelete("{stationId}")]
        public async Task<IActionResult> DeleteStation(string stationId)
        {
            if (string.IsNullOrWhiteSpace(stationId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Station ID is required."
                });
            }

            try
            {
                var station = await _service.DeleteStationAsync(stationId);

                if (station == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = $"No station found with ID '{stationId}'."
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Station deleted successfully.",
                    data = station
                });
            }
            catch (InvalidOperationException ex)
            {
                // Blocked because a reservation still references this station
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // Get slots from a single station, or only one month's slots when month=yyyy-MM is given.
        [Authorize]
        [HttpGet("{stationId}/slots")]
        public async Task<IActionResult> GetSlotsForStation(string stationId, [FromQuery] string? month)
        {
            if (string.IsNullOrWhiteSpace(stationId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Station ID is required."
                });
            }

            List<EnergyBookingSlot>? slots;

            if (string.IsNullOrWhiteSpace(month))
            {
                slots = await _slotService.GetSlotsForStationAsync(stationId);
            }
            else
            {
                // Accepts a year and month only, e.g. 2026-09
                if (!DateTime.TryParseExact(month, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var monthStart))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "month must be in yyyy-MM format, e.g. 2026-09."
                    });
                }

                slots = await _slotService.GetSlotsForStationInMonthAsync(stationId, monthStart.Year, monthStart.Month);
            }

            // Service returns null, when the station itself doesn't exist. 200 if station exist but no slots (empty list)
            if (slots == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = $"No station found with ID '{stationId}'."
                });
            }
 
            return Ok(new
            {
                success = true,
                data = slots
            });
        }

        // Creates one slot per selected weekday within a date range, skipping any day that already has a slot at that time.
        [Authorize(Roles = Roles.Backoffice)]
        [HttpPost("{stationId}/slots")]
        public async Task<IActionResult> GenerateRecurringSlots(string stationId, [FromBody] CreateSlotRequest request)
        {
            if (string.IsNullOrWhiteSpace(stationId))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Station ID is required."
                });
            }

            if (request == null)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "A slot generation request body is required."
                });
            }

            try
            {
                var (created, skipped) = await _slotService.GenerateRecurringSlotsAsync(stationId, request);

                return Ok(new
                {
                    success = true,
                    message = $"{created.Count} slot(s) created, {skipped.Count} skipped.",
                    data = new { created, skipped }
                });
            }
            catch (KeyNotFoundException ex)
            {
                // The referenced station doesn't exist
                return NotFound(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (ArgumentException ex)
            {
                // Invalid day name, time format, date range, or a time outside the station's hours
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                // The station is deactivated or its schedule can't be read
                return Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }
    }
}

// File: StationsController.cs
// Purpose: HTTP endpoints for microgrid station management.
// Author: IT23215856

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

        public StationsController(StationService service)
        {
            // Stores the injected service, this controller only handles HTTP concerns
            _service = service;
        }

        // Creates a new microgrid station. Restricted to Backoffice users per the endpoint contract: the JWT must be valid and carry the Backoffice role.
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
    }
}

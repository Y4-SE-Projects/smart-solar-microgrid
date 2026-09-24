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
    }
}

/*
* File: UpdateReservationStatusRequest.cs
* Purpose: Defines the only field a GridOperator may supply when changing a reservation status.
*/

namespace API.DTOs
{
    public class UpdateReservationStatusRequest
    {
        public string? Status { get; set; }
    }
}

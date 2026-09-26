/*
* File: ReservationListQuery.cs
* Purpose: Query parameters and paged result for the operator reservation list (GET /api/reservations).
*/

using API.Models;

namespace API.DTOs
{
    public class ReservationListQuery
    {
        // 1-based page number
        public int Page { get; set; } = 1;

        // Rows per page, allowed range 1-50
        public int PageSize { get; set; } = 25;

        // Pending, Approved, Declined, Completed or Cancelled. Empty / "All" means every status.
        public string? Status { get; set; }

        // Exact station ID match
        public string? StationId { get; set; }

        // Inclusive range on the scheduled time. A date without a time is read as UTC.
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }

        // Partial, case-insensitive match on reservation ID, prosumer NIC or station ID
        public string? Search { get; set; }
    }

    public class PagedReservationResult
    {
        public List<EnergyReservation> Items { get; set; } = new();
        public long TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}

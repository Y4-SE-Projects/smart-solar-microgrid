/*
* File: QrDtos.cs
* Purpose: Request and response shapes for the QR verification endpoints.
*/

namespace API.DTOs
{
    // Body for POST /api/reservations/verify-qr. The operator identity is taken from the JWT, never from here.
    public class VerifyQrRequest
    {
        public string? QrCodeData { get; set; }
    }

    // Returned only to the owning Prosumer.
    public class QrResponse
    {
        public string ReservationId { get; set; } = string.Empty;
        public string QrCodeData { get; set; } = string.Empty;
        public DateTime ScheduledTime { get; set; }
        public DateTime ValidFrom { get; set; }
        public DateTime ExpiresAt { get; set; }
    }

    public class VerifyQrResponse
    {
        public string ReservationId { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime VerifiedAt { get; set; }
        public string Result { get; set; } = "Success";

        // True when this was a retry of a verification the same operator already completed.
        public bool AlreadyProcessed { get; set; }
    }

    // State only. Never contains the payload, nonce or signature.
    public class QrStatusResponse
    {
        public string ReservationId { get; set; } = string.Empty;
        public string ReservationStatus { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int Version { get; set; }
        public DateTime? IssuedAt { get; set; }
        public DateTime ValidFrom { get; set; }
        public DateTime ExpiresAt { get; set; }
        public int RegenerationCount { get; set; }
        public DateTime? UsedAt { get; set; }
        public string? UsedByOperator { get; set; }
    }

    public class QrScanEntryResponse
    {
        public string? ReservationId { get; set; }
        public DateTime At { get; set; }
        public string Operator { get; set; } = string.Empty;
        public string Result { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }
}

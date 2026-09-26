/* File: QrSettings.cs
 * Purpose: Strongly-typed representation of the "QrSettings" section in appsettings.json.
 */

namespace API.Settings
{
    public class QrSettings
    {
        // Server-only secret used to HMAC-sign QR payloads. ( Must be long/random, at least 32 characters )
        public string SigningSecret { get; set; } = string.Empty;

        // How many minutes before the scheduled time a QR becomes usable.
        public int EarlyAccessMinutes { get; set; } = 30;

        // How many minutes after the scheduled time a QR stops being usable.
        public int ExpiryAfterScheduledMinutes { get; set; } = 120;

        // How many times a Prosumer may regenerate the QR of one reservation.
        public int MaxRegenerations { get; set; } = 3;

        // How many scan attempts are kept on a reservation ( oldest are dropped ).
        public int ScanLogLimit { get; set; } = 20;

        // Rate limit for the verify-qr endpoint, per authenticated operator.
        public int VerifyRequestsPerMinute { get; set; } = 30;
    }
}

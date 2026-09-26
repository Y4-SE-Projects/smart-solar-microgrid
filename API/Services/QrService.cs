/*
* File: QrService.cs
* Purpose: Cryptographic and parsing helpers for reservation QR codes ( nonce, HMAC signing, parsing,
*          signature verification, validity window ). Holds no reservation business logic.
*/

using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using API.Models;
using API.Settings;
using Microsoft.Extensions.Options;

namespace API.Services
{
    public record QrPayload(string ReservationId, int Version, string Nonce, string Signature);

    public class QrService
    {
        // Reservation IDs are generated as "RES-" + 8 digits, e.g. RES-48213907.
        public static readonly Regex ReservationIdPattern = new(@"^RES-\d{8}$", RegexOptions.Compiled);

        private static readonly Regex Base64UrlPattern = new(@"^[A-Za-z0-9_-]+$", RegexOptions.Compiled);

        private const int MaxPayloadLength = 512;

        private readonly byte[] _secret;
        private readonly QrSettings _settings;

        public QrService(IOptions<QrSettings> options)
        {
            _settings = options.Value;
            _secret = Encoding.UTF8.GetBytes(_settings.SigningSecret);
        }

        public string GenerateNonce()
        {
            return ToBase64Url(RandomNumberGenerator.GetBytes(32));
        }

        // Builds the initial ( version 1 ) QR state and its signed payload for a newly approved reservation.
        public (QrInfo Qr, string QrCodeData) CreateInitial(string reservationId)
        {
            var qr = new QrInfo
            {
                Nonce = GenerateNonce(),
                Version = 1,
                Status = QrStatuses.Active,
                IssuedAt = DateTime.UtcNow,
                RegenerationCount = 0
            };

            return (qr, BuildPayload(reservationId, qr.Version, qr.Nonce));
        }

        // reservationId.version.nonce.signature
        public string BuildPayload(string reservationId, int version, string nonce)
        {
            return $"{SignedMessage(reservationId, version, nonce)}.{Sign(reservationId, version, nonce)}";
        }

        public bool TryParse(string? qrCodeData, out QrPayload? payload)
        {
            payload = null;

            if (string.IsNullOrWhiteSpace(qrCodeData) || qrCodeData.Length > MaxPayloadLength)
            {
                return false;
            }

            var parts = qrCodeData.Trim().Split('.');

            if (parts.Length != 4)
            {
                return false;
            }

            if (!ReservationIdPattern.IsMatch(parts[0]) ||
                !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var version) ||
                version < 1 ||
                !Base64UrlPattern.IsMatch(parts[2]) ||
                !Base64UrlPattern.IsMatch(parts[3]))
            {
                return false;
            }

            payload = new QrPayload(parts[0], version, parts[2], parts[3]);
            return true;
        }

        public bool VerifySignature(QrPayload payload)
        {
            var expected = Sign(payload.ReservationId, payload.Version, payload.Nonce);
            return FixedTimeEquals(expected, payload.Signature);
        }

        public static bool FixedTimeEquals(string a, string b)
        {
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(a),
                Encoding.UTF8.GetBytes(b));
        }

        // The window is derived from the live scheduled time, so nothing about it is stored.
        public (DateTime ValidFrom, DateTime ExpiresAt) GetValidityWindow(DateTime scheduledTimeUtc)
        {
            return (
                scheduledTimeUtc.AddMinutes(-_settings.EarlyAccessMinutes),
                scheduledTimeUtc.AddMinutes(_settings.ExpiryAfterScheduledMinutes));
        }

        private static string SignedMessage(string reservationId, int version, string nonce)
        {
            return $"{reservationId}.{version.ToString(CultureInfo.InvariantCulture)}.{nonce}";
        }

        private string Sign(string reservationId, int version, string nonce)
        {
            using var hmac = new HMACSHA256(_secret);
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(SignedMessage(reservationId, version, nonce)));
            return ToBase64Url(hash);
        }

        private static string ToBase64Url(byte[] bytes)
        {
            return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
    }
}

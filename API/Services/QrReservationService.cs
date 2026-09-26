/*
* File: QrReservationService.cs
* Purpose: QR business logic for reservations: retrieval, regeneration, atomic verification, revocation,
*          status and audit. All QR state lives inside the EnergyReservation document.
*/

using API.Data;
using API.DTOs;
using API.Models;
using API.Settings;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace API.Services
{
    public class QrReservationService
    {
        private const int RecentScanCount = 20;

        private readonly IMongoCollection<EnergyReservation> _reservations;
        private readonly QrService _qr;
        private readonly QrSettings _settings;
        private readonly ILogger<QrReservationService> _logger;

        private enum Evaluation
        {
            Proceed,
            Retry
        }

        public QrReservationService(
            MongoDbContext context,
            QrService qr,
            IOptions<QrSettings> options,
            ILogger<QrReservationService> logger)
        {
            _reservations = context.GetCollection<EnergyReservation>(MongoCollectionNames.EnergyReservation);
            _qr = qr;
            _settings = options.Value;
            _logger = logger;
        }

        // ---------- Prosumer ----------

        public async Task<QrResponse> GetQrForProsumerAsync(string reservationId, string prosumerNic)
        {
            var reservation = await LoadAsync(reservationId);
            EnsureOwner(reservation, prosumerNic);
            EnsureApproved(reservation);

            reservation = await EnsureQrIssuedAsync(reservation);
            EnsureQrActive(reservation.Qr!);

            return BuildQrResponse(reservation);
        }

        public async Task<QrResponse> RegenerateQrAsync(string reservationId, string prosumerNic)
        {
            var reservation = await LoadAsync(reservationId);
            EnsureOwner(reservation, prosumerNic);
            EnsureApproved(reservation);

            reservation = await EnsureQrIssuedAsync(reservation);
            var current = reservation.Qr!;
            EnsureQrActive(current);

            if (current.RegenerationCount >= _settings.MaxRegenerations)
            {
                throw new QrOperationException(
                    "QR_REGENERATION_LIMIT", StatusCodes.Status409Conflict,
                    "The maximum number of QR regenerations for this reservation has been reached.");
            }

            var newVersion = current.Version + 1;
            var newNonce = _qr.GenerateNonce();
            var now = DateTime.UtcNow;

            // Conditional on the version we read, so two racing regenerations cannot both succeed.
            var filter = Builders<EnergyReservation>.Filter.And(
                Builders<EnergyReservation>.Filter.Eq(r => r.ReservationId, reservation.ReservationId),
                Builders<EnergyReservation>.Filter.Eq(r => r.Status, "Approved"),
                Builders<EnergyReservation>.Filter.Eq(r => r.Qr!.Status, QrStatuses.Active),
                Builders<EnergyReservation>.Filter.Eq(r => r.Qr!.Version, current.Version));

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Qr!.Nonce, newNonce)
                .Set(r => r.Qr!.Version, newVersion)
                .Set(r => r.Qr!.IssuedAt, now)
                .Inc(r => r.Qr!.RegenerationCount, 1)
                .Set(r => r.QrCodeData, _qr.BuildPayload(reservation.ReservationId, newVersion, newNonce))
                .Set(r => r.UpdatedAt, now);

            var updated = await _reservations.FindOneAndUpdateAsync(
                filter,
                update,
                new FindOneAndUpdateOptions<EnergyReservation> { ReturnDocument = ReturnDocument.After });

            if (updated == null)
            {
                throw new QrOperationException(
                    "QR_CONFLICT", StatusCodes.Status409Conflict,
                    "The QR changed before it could be regenerated. Please try again.");
            }

            return BuildQrResponse(updated);
        }

        // ---------- GridOperator: verify ----------

        public async Task<VerifyQrResponse> VerifyAsync(string? qrCodeData, string operatorId)
        {
            if (!_qr.TryParse(qrCodeData, out var payload) || payload == null)
            {
                _logger.LogWarning("QR verification rejected: malformed payload from operator {Operator}.", operatorId);
                throw new QrOperationException(
                    "QR_INVALID", StatusCodes.Status400BadRequest, "The QR code is invalid.", "InvalidFormat");
            }

            if (!_qr.VerifySignature(payload))
            {
                _logger.LogWarning("QR verification rejected: bad signature from operator {Operator}.", operatorId);
                throw new QrOperationException(
                    "QR_INVALID", StatusCodes.Status400BadRequest, "The QR code is invalid.", "InvalidSignature");
            }

            var reservation = await _reservations
                .Find(r => r.ReservationId == payload.ReservationId)
                .FirstOrDefaultAsync();

            if (reservation == null)
            {
                throw ReservationNotFound();
            }

            try
            {
                if (Evaluate(reservation, payload, operatorId, DateTime.UtcNow) == Evaluation.Retry)
                {
                    return BuildVerifyResponse(reservation, alreadyProcessed: true);
                }

                var now = DateTime.UtcNow;

                // Atomic single-use finalization: only one concurrent request can match this filter.
                var filter = Builders<EnergyReservation>.Filter.And(
                    Builders<EnergyReservation>.Filter.Eq(r => r.ReservationId, payload.ReservationId),
                    Builders<EnergyReservation>.Filter.Eq(r => r.Status, "Approved"),
                    Builders<EnergyReservation>.Filter.Eq(r => r.Qr!.Status, QrStatuses.Active),
                    Builders<EnergyReservation>.Filter.Eq(r => r.Qr!.Version, payload.Version),
                    Builders<EnergyReservation>.Filter.Eq(r => r.Qr!.Nonce, payload.Nonce));

                var successScan = NewScan(operatorId, "Success", "QR verified successfully.", now);

                var update = Builders<EnergyReservation>.Update
                    .Set(r => r.Status, "Completed")
                    .Set(r => r.Qr!.Status, QrStatuses.Used)
                    .Set(r => r.Qr!.UsedAt, now)
                    .Set(r => r.Qr!.UsedByOperator, operatorId)
                    .Set(r => r.UpdatedAt, now)
                    .PushEach(r => r.Qr!.Scans, new[] { successScan }, slice: -_settings.ScanLogLimit);

                var completed = await _reservations.FindOneAndUpdateAsync(
                    filter,
                    update,
                    new FindOneAndUpdateOptions<EnergyReservation> { ReturnDocument = ReturnDocument.After });

                if (completed != null)
                {
                    return BuildVerifyResponse(completed, alreadyProcessed: false, verifiedAt: now);
                }

                // Lost a race or the state changed: reload and report the precise reason.
                reservation = await _reservations
                    .Find(r => r.ReservationId == payload.ReservationId)
                    .FirstOrDefaultAsync() ?? throw ReservationNotFound();

                if (Evaluate(reservation, payload, operatorId, DateTime.UtcNow) == Evaluation.Retry)
                {
                    return BuildVerifyResponse(reservation, alreadyProcessed: true);
                }

                throw new QrOperationException(
                    "QR_CONFLICT", StatusCodes.Status409Conflict,
                    "The reservation changed during verification. Please scan again.", "Conflict");
            }
            catch (QrOperationException ex) when (!string.IsNullOrEmpty(ex.AuditResult) && reservation.Qr != null)
            {
                await AppendScanSafelyAsync(reservation.ReservationId, operatorId, ex.AuditResult, ex.Message);
                throw;
            }
        }

        // ---------- GridOperator / Backoffice ----------

        public async Task<QrStatusResponse> GetStatusAsync(string reservationId)
        {
            var reservation = await LoadAsync(reservationId);
            var (validFrom, expiresAt) = _qr.GetValidityWindow(reservation.ScheduledTime);
            var qr = reservation.Qr;

            return new QrStatusResponse
            {
                ReservationId = reservation.ReservationId,
                ReservationStatus = reservation.Status,
                Status = qr?.Status ?? "NotIssued",
                Version = qr?.Version ?? 0,
                IssuedAt = qr?.IssuedAt,
                ValidFrom = validFrom,
                ExpiresAt = expiresAt,
                RegenerationCount = qr?.RegenerationCount ?? 0,
                UsedAt = qr?.UsedAt,
                UsedByOperator = qr?.UsedByOperator
            };
        }

        public async Task RevokeQrAsync(string reservationId)
        {
            var id = NormalizeId(reservationId);

            var filter = Builders<EnergyReservation>.Filter.And(
                Builders<EnergyReservation>.Filter.Eq(r => r.ReservationId, id),
                Builders<EnergyReservation>.Filter.Eq(r => r.Qr!.Status, QrStatuses.Active));

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Qr!.Status, QrStatuses.Revoked)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var result = await _reservations.UpdateOneAsync(filter, update);

            if (result.ModifiedCount == 1)
            {
                return;
            }

            var reservation = await LoadAsync(id);
            EnsureQrActive(reservation.Qr ?? throw new QrOperationException(
                "QR_NOT_ISSUED", StatusCodes.Status409Conflict, "No QR has been issued for this reservation."));

            throw new QrOperationException(
                "QR_CONFLICT", StatusCodes.Status409Conflict, "The QR could not be revoked. Please try again.");
        }

        public async Task<List<QrScanEntryResponse>> GetAuditAsync(string reservationId)
        {
            var reservation = await LoadAsync(reservationId);

            return (reservation.Qr?.Scans ?? new List<QrScanAttempt>())
                .OrderByDescending(s => s.At)
                .Select(s => new QrScanEntryResponse
                {
                    ReservationId = reservation.ReservationId,
                    At = s.At,
                    Operator = s.Operator,
                    Result = s.Result,
                    Reason = s.Reason
                })
                .ToList();
        }

        public async Task<List<QrScanEntryResponse>> GetRecentScansAsync(string operatorId)
        {
            var pipeline = new[]
            {
                new BsonDocument("$match", new BsonDocument("qr.scans.operator", operatorId)),
                new BsonDocument("$unwind", "$qr.scans"),
                new BsonDocument("$match", new BsonDocument("qr.scans.operator", operatorId)),
                new BsonDocument("$sort", new BsonDocument("qr.scans.at", -1)),
                new BsonDocument("$limit", RecentScanCount),
                new BsonDocument("$project", new BsonDocument
                {
                    { "_id", 0 },
                    { "reservationId", 1 },
                    { "scan", "$qr.scans" }
                })
            };

            var documents = await _reservations.Aggregate<BsonDocument>(pipeline).ToListAsync();

            return documents.Select(d =>
            {
                var scan = d["scan"].AsBsonDocument;
                return new QrScanEntryResponse
                {
                    ReservationId = d["reservationId"].AsString,
                    At = scan["at"].ToUniversalTime(),
                    Operator = scan["operator"].AsString,
                    Result = scan["result"].AsString,
                    Reason = scan["reason"].AsString
                };
            }).ToList();
        }

        // ---------- Helpers ----------

        // Runs every live-data check in order. Returns Retry when the same operator is repeating a
        // verification that already succeeded ( e.g. the response was lost on a mobile network ).
        private Evaluation Evaluate(EnergyReservation reservation, QrPayload payload, string operatorId, DateTime now)
        {
            var qr = reservation.Qr ?? throw new QrOperationException(
                "QR_INVALID", StatusCodes.Status400BadRequest, "The QR code is invalid.", "InvalidFormat");

            var nonceMatches = QrService.FixedTimeEquals(qr.Nonce, payload.Nonce);

            if (string.Equals(reservation.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                if (qr.Status == QrStatuses.Used &&
                    qr.UsedByOperator == operatorId &&
                    qr.Version == payload.Version &&
                    nonceMatches)
                {
                    return Evaluation.Retry;
                }

                throw new QrOperationException(
                    "QR_ALREADY_USED", StatusCodes.Status409Conflict,
                    "This QR code has already been used.", "AlreadyUsed");
            }

            if (!string.Equals(reservation.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                throw new QrOperationException(
                    "RESERVATION_NOT_APPROVED", StatusCodes.Status409Conflict,
                    "The reservation is not approved.", "ReservationNotApproved");
            }

            if (qr.Version != payload.Version)
            {
                throw new QrOperationException(
                    "QR_REPLACED", StatusCodes.Status409Conflict,
                    "This QR code has been replaced by a newer one.", "Replaced");
            }

            if (!nonceMatches)
            {
                throw new QrOperationException(
                    "QR_INVALID", StatusCodes.Status400BadRequest, "The QR code is invalid.", "InvalidNonce");
            }

            if (qr.Status == QrStatuses.Used)
            {
                throw new QrOperationException(
                    "QR_ALREADY_USED", StatusCodes.Status409Conflict,
                    "This QR code has already been used.", "AlreadyUsed");
            }

            if (qr.Status == QrStatuses.Revoked)
            {
                throw new QrOperationException(
                    "QR_REVOKED", StatusCodes.Status409Conflict,
                    "This QR code has been revoked.", "Revoked");
            }

            var (validFrom, expiresAt) = _qr.GetValidityWindow(reservation.ScheduledTime);

            if (now < validFrom)
            {
                throw new QrOperationException(
                    "QR_NOT_YET_VALID", StatusCodes.Status409Conflict,
                    "This QR code is not yet valid.", "NotYetValid");
            }

            if (now > expiresAt)
            {
                throw new QrOperationException(
                    "QR_EXPIRED", StatusCodes.Status409Conflict,
                    "This QR code has expired.", "Expired");
            }

            return Evaluation.Proceed;
        }

        private async Task<EnergyReservation> LoadAsync(string reservationId)
        {
            var id = NormalizeId(reservationId);

            return await _reservations
                .Find(r => r.ReservationId == id)
                .FirstOrDefaultAsync() ?? throw ReservationNotFound();
        }

        private static string NormalizeId(string reservationId)
        {
            var id = reservationId?.Trim() ?? string.Empty;

            if (!QrService.ReservationIdPattern.IsMatch(id))
            {
                throw new QrOperationException(
                    "INVALID_RESERVATION_ID", StatusCodes.Status400BadRequest, "Reservation ID is invalid.");
            }

            return id;
        }

        private static QrOperationException ReservationNotFound()
        {
            return new QrOperationException(
                "RESERVATION_NOT_FOUND", StatusCodes.Status404NotFound, "Reservation not found.");
        }

        private static void EnsureOwner(EnergyReservation reservation, string prosumerNic)
        {
            if (!string.Equals(reservation.ProsumerNic, prosumerNic, StringComparison.Ordinal))
            {
                throw new QrOperationException(
                    "FORBIDDEN", StatusCodes.Status403Forbidden,
                    "A Prosumer may access only the QR of their own reservation.");
            }
        }

        private static void EnsureApproved(EnergyReservation reservation)
        {
            if (!string.Equals(reservation.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                throw new QrOperationException(
                    "RESERVATION_NOT_APPROVED", StatusCodes.Status409Conflict,
                    "A QR is available only for an approved reservation.");
            }
        }

        private static void EnsureQrActive(QrInfo qr)
        {
            if (qr.Status == QrStatuses.Used)
            {
                throw new QrOperationException(
                    "QR_ALREADY_USED", StatusCodes.Status409Conflict, "This QR code has already been used.");
            }

            if (qr.Status == QrStatuses.Revoked)
            {
                throw new QrOperationException(
                    "QR_REVOKED", StatusCodes.Status409Conflict, "This QR code has been revoked.");
            }
        }

        // Reservations approved before the QR feature existed have no QR yet; issue one on first access.
        private async Task<EnergyReservation> EnsureQrIssuedAsync(EnergyReservation reservation)
        {
            if (reservation.Qr != null)
            {
                return reservation;
            }

            var (qr, qrCodeData) = _qr.CreateInitial(reservation.ReservationId);

            var filter = Builders<EnergyReservation>.Filter.And(
                Builders<EnergyReservation>.Filter.Eq(r => r.ReservationId, reservation.ReservationId),
                Builders<EnergyReservation>.Filter.Eq(r => r.Status, "Approved"),
                Builders<EnergyReservation>.Filter.Eq(r => r.Qr, null));

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Qr, qr)
                .Set(r => r.QrCodeData, qrCodeData)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var issued = await _reservations.FindOneAndUpdateAsync(
                filter,
                update,
                new FindOneAndUpdateOptions<EnergyReservation> { ReturnDocument = ReturnDocument.After });

            // If another request issued it first, use the stored one.
            var result = issued ?? await LoadAsync(reservation.ReservationId);

            if (result.Qr == null)
            {
                throw new QrOperationException(
                    "QR_NOT_ISSUED", StatusCodes.Status409Conflict, "No QR has been issued for this reservation.");
            }

            return result;
        }

        private QrResponse BuildQrResponse(EnergyReservation reservation)
        {
            var qr = reservation.Qr!;
            var (validFrom, expiresAt) = _qr.GetValidityWindow(reservation.ScheduledTime);

            return new QrResponse
            {
                ReservationId = reservation.ReservationId,
                QrCodeData = _qr.BuildPayload(reservation.ReservationId, qr.Version, qr.Nonce),
                ScheduledTime = reservation.ScheduledTime,
                ValidFrom = validFrom,
                ExpiresAt = expiresAt
            };
        }

        private static VerifyQrResponse BuildVerifyResponse(
            EnergyReservation reservation,
            bool alreadyProcessed,
            DateTime? verifiedAt = null)
        {
            return new VerifyQrResponse
            {
                ReservationId = reservation.ReservationId,
                Status = reservation.Status,
                VerifiedAt = verifiedAt ?? reservation.Qr?.UsedAt ?? reservation.UpdatedAt,
                Result = "Success",
                AlreadyProcessed = alreadyProcessed
            };
        }

        private static QrScanAttempt NewScan(string operatorId, string result, string reason, DateTime at)
        {
            return new QrScanAttempt { At = at, Operator = operatorId, Result = result, Reason = reason };
        }

        // Audit writes must never mask the real verification error.
        private async Task AppendScanSafelyAsync(string reservationId, string operatorId, string result, string reason)
        {
            try
            {
                var update = Builders<EnergyReservation>.Update.PushEach(
                    r => r.Qr!.Scans,
                    new[] { NewScan(operatorId, result, reason, DateTime.UtcNow) },
                    slice: -_settings.ScanLogLimit);

                await _reservations.UpdateOneAsync(r => r.ReservationId == reservationId && r.Qr != null, update);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to record QR scan audit for reservation {ReservationId}.", reservationId);
            }
        }
    }
}

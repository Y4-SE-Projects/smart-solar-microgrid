/*
* File: QrInfo.cs
* Purpose: Embedded QR state stored inside an EnergyReservation document ( no separate collection ).
*/

using MongoDB.Bson.Serialization.Attributes;

namespace API.Models
{
    public static class QrStatuses
    {
        public const string Active = "Active";
        public const string Used = "Used";
        public const string Revoked = "Revoked";
    }

    [BsonIgnoreExtraElements]
    public class QrInfo
    {
        [BsonElement("nonce")]
        public string Nonce { get; set; } = string.Empty;

        [BsonElement("version")]
        public int Version { get; set; }

        [BsonElement("status")]
        public string Status { get; set; } = QrStatuses.Active;

        [BsonElement("issuedAt")]
        public DateTime IssuedAt { get; set; }

        [BsonElement("regenerationCount")]
        public int RegenerationCount { get; set; }

        [BsonElement("usedAt")]
        public DateTime? UsedAt { get; set; }

        [BsonElement("usedByOperator")]
        public string? UsedByOperator { get; set; }

        [BsonElement("scans")]
        public List<QrScanAttempt> Scans { get; set; } = new();
    }
}

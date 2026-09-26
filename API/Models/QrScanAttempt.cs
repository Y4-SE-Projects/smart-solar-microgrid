/*
* File: QrScanAttempt.cs
* Purpose: One audit entry for a QR verification attempt, embedded in QrInfo.Scans.
*/

using MongoDB.Bson.Serialization.Attributes;

namespace API.Models
{
    [BsonIgnoreExtraElements]
    public class QrScanAttempt
    {
        [BsonElement("at")]
        public DateTime At { get; set; }

        [BsonElement("operator")]
        public string Operator { get; set; } = string.Empty;

        [BsonElement("result")]
        public string Result { get; set; } = string.Empty;

        [BsonElement("reason")]
        public string Reason { get; set; } = string.Empty;
    }
}

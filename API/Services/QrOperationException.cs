/*
* File: QrOperationException.cs
* Purpose: Carries a stable application error code and HTTP status for QR failures.
*/

namespace API.Services
{
    public class QrOperationException : Exception
    {
        public string Code { get; }
        public int StatusCode { get; }

        // Value recorded in the scan audit ( NotYetValid, Expired, Replaced, ... )
        public string AuditResult { get; }

        public QrOperationException(string code, int statusCode, string message, string auditResult = "")
            : base(message)
        {
            Code = code;
            StatusCode = statusCode;
            AuditResult = auditResult;
        }
    }
}

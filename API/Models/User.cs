/* File: User.cs
 * Purpose: Represents one document in the "Users" MongoDB collection.
 * Author: IT23218512
 */

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace API.Models
{
    public class User
    {
        // MongoDB's own document identifier. Not used for login.
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        // Primary key for Prosumer accounts. ( Null/unused for Backoffice & GridOperator )
        [BsonElement("nic")]
        public string? Nic { get; set; }

        // Login identifier for Backoffice/GridOperator accounts. ( Null/unused for Prosumers )
        [BsonElement("username")]
        public string? Username { get; set; }

        // BCrypt hash of the password. ( Never store or return the plain text password )
        [BsonElement("passwordHash")]
        public string PasswordHash { get; set; } = string.Empty;

        // One of Roles.Backoffice, Roles.GridOperator, Roles.Prosumer
        [BsonElement("role")]
        public string Role { get; set; } = string.Empty;

        [BsonElement("fullName")]
        public string FullName { get; set; } = string.Empty;

        [BsonElement("email")]
        public string Email { get; set; } = string.Empty;

        [BsonElement("phone")]
        public string Phone { get; set; } = string.Empty;

        // Flipped to false when a Prosumer requests deactivation.
        // Only a Backoffice user can set this back to true.
        [BsonElement("isActive")]
        public bool IsActive { get; set; } = true;

        // Optional reason the Prosumer gave when requesting deactivation.
        // Null when never deactivated, and cleared back to null on reactivation.
        [BsonElement("deactivationReason")]
        public string? DeactivationReason { get; set; }

        // Compute "days elapsed" for the Backoffice review screen when the account was deactivated.
        // Null when active.
        [BsonElement("deactivatedAt")]
        public DateTime? DeactivatedAt { get; set; }

        // Set when a deactivated Prosumer asks to have the account restored.
        // Separates a plain deactivated account from one sitting in the Backoffice queue.
        [BsonElement("reactivationRequestedAt")]
        public DateTime? ReactivationRequestedAt { get; set; }

        // Set when a Backoffice user declines a reactivation request. 
        [BsonElement("reactivationRejectedAt")]
        public DateTime? ReactivationRejectedAt { get; set; }

        // Optional reason the Backoffice user gave when declining.
        [BsonElement("reactivationRejectionReason")]
        public string? ReactivationRejectionReason { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
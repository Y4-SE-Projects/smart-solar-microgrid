/* File: AccountStatus.cs
 * Purpose: The three states a Prosumer account can be in, as reported to both clients.         
 * Author: IT23218512
 */

namespace API.Models
{
    public static class AccountStatus
    {
        // IsActive is true. The Prosumer can log in and make reservations.
        public const string Active = "Active";

        // IsActive is false and no reactivation request is outstanding.
        public const string Deactivated = "Deactivated";

        // IsActive is false and the Prosumer has asked to be restored.
        // These are the accounts the Backoffice queue works through.
        public const string PendingReactivation = "PendingReactivation";
    }
}
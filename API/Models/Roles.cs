/* File: Roles.cs
 * Purpose: Single source of truth for the 3 exact role string values used across the system.
 * Author: IT23218512 
 */

namespace API.Models
{
    public static class Roles
    {
        public const string Backoffice = "Backoffice";
        public const string GridOperator = "GridOperator";
        public const string Prosumer = "Prosumer";
    }
}
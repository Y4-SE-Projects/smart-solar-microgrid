/* File: AccountRules.cs
 * Purpose: The validation rules for account fields, in one place for every endpoint (and the startup seed) that sets them.
 *          Each check returns the message to show, or null when the value is valid.
 * Author: IT23218512
 */

using System.Text.RegularExpressions;

namespace API.Models
{
    public static class AccountRules
    {
        // Longest email address the API accepts; also the practical limit for an address in use.
        public const int MaximumEmailLength = 254;

        // Something@something.something, with no spaces and a single "@".
        // NonBacktracking keeps matching time linear in the length, so a crafted value can't stall the request.
        // ( The default engine backtracks: matching time grows with the square of the length on inputs like "a@a.a.a.…@". )
        private static readonly Regex EmailPattern = new(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.NonBacktracking);

        // Checks a required email address. The length is checked before the pattern runs.
        public static string? ValidateEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return "Email is required.";
            }

            var trimmed = email.Trim();

            if (trimmed.Length > MaximumEmailLength)
            {
                return $"Email must be at most {MaximumEmailLength} characters.";
            }

            if (!EmailPattern.IsMatch(trimmed))
            {
                return "Enter a valid email address.";
            }

            return null;
        }
    }
}

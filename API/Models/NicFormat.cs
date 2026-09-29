/* File: NicFormat.cs
 * Purpose: The rules for a Sri Lankan NIC, in one place for every account endpoint that takes one.
 *          Accepts the old format (9 digits + V or X) and the new format (12 digits).
 * Author: IT23218512
 */

using System.Text.RegularExpressions;

namespace API.Models
{
    public static class NicFormat
    {
        private static readonly Regex Pattern = new(@"^(\d{9}[VvXx]|\d{12})$", RegexOptions.Compiled);

        // Trims the value and upper-cases the old-format letter.
        public static string Normalize(string? nic)
        {
            return nic?.Trim().ToUpperInvariant() ?? string.Empty;
        }

        public static bool IsValid(string? nic)
        {
            return !string.IsNullOrEmpty(nic) && Pattern.IsMatch(nic);
        }
    }
}
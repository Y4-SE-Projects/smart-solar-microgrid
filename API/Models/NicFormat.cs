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
        // [0-9] rather than \d: in .NET, \d matches any Unicode digit ( e.g. full-width "２" or Arabic-Indic "٢" ).
        // Those would pass as a NIC yet be stored as different text from the same number in plain digits, so the duplicate check would miss them.
        private static readonly Regex Pattern = new(@"^([0-9]{9}[VvXx]|[0-9]{12})$", RegexOptions.Compiled);

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
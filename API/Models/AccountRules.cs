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

        // Shortest and longest staff username the API accepts.
        public const int MinimumUsernameLength = 3;
        public const int MaximumUsernameLength = 50;

        // A letter first, then letters, digits, ".", "_" or "-".
        // Usernames travel in URL paths ( /users/staff/{username} ), so "/", "#", "?" and "%" must never appear, and "." or ".." can't be a whole name.
        // Starting with a letter also keeps a username from ever looking like a NIC, which always starts with a digit.
        private static readonly Regex UsernamePattern = new(@"^[A-Za-z][A-Za-z0-9._-]*$", RegexOptions.NonBacktracking);

        // Checks a required staff username.
        public static string? ValidateUsername(string? username)
        {
            if (string.IsNullOrWhiteSpace(username))
            {
                return "Username is required.";
            }

            var trimmed = username.Trim();

            if (trimmed.Length < MinimumUsernameLength
                || trimmed.Length > MaximumUsernameLength
                || !UsernamePattern.IsMatch(trimmed))
            {
                return $"Username must be {MinimumUsernameLength}–{MaximumUsernameLength} characters, start with a letter, " +
                       "and use only letters, numbers, dots, hyphens or underscores.";
            }

            return null;
        }

        // Longest full name the API accepts. Names are shown in web tables and on mobile cards, so an unbounded one would break those layouts.
        public const int MaximumFullNameLength = 100;

        // Checks a required full name.
        public static string? ValidateFullName(string? fullName)
        {
            if (string.IsNullOrWhiteSpace(fullName))
            {
                return "Full name is required.";
            }

            if (fullName.Trim().Length > MaximumFullNameLength)
            {
                return $"Full name must be at most {MaximumFullNameLength} characters.";
            }

            return null;
        }

        // Fewest and most digits a phone number may have: covers local numbers ( 0771234567 ) and international ones ( +94 77 123 4567 ).
        public const int MinimumPhoneDigits = 9;
        public const int MaximumPhoneDigits = 15;

        // Longest phone number including spaces, hyphens and "+". Room for 15 digits with separators, without allowing padding.
        public const int MaximumPhoneLength = 20;

        // An optional "+", then digits, with spaces or hyphens allowed between them ( the Android phone keyboard offers hyphens ).
        // [0-9] rather than \d, which in .NET also matches non-English digits.
        private static readonly Regex PhonePattern = new(@"^\+?[0-9][0-9 -]*$", RegexOptions.NonBacktracking);

        // Checks a required phone number: overall length, then allowed characters, then how many digits it has.
        public static string? ValidatePhone(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone))
            {
                return "Phone number is required.";
            }

            var trimmed = phone.Trim();

            if (trimmed.Length > MaximumPhoneLength)
            {
                return $"Phone number must be at most {MaximumPhoneLength} characters.";
            }
            var digitCount = trimmed.Count(c => c >= '0' && c <= '9');

            if (!PhonePattern.IsMatch(trimmed) || digitCount < MinimumPhoneDigits || digitCount > MaximumPhoneDigits)
            {
                return $"Enter a valid phone number: {MinimumPhoneDigits} to {MaximumPhoneDigits} digits, optionally starting with +.";
            }

            return null;
        }

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

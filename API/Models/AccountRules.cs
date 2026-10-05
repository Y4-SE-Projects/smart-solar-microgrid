/* File: AccountRules.cs
 * Purpose: The validation rules for account fields, in one place for every endpoint (and the startup seed) that sets them.
 *          Each check returns the message to show, or null when the value is valid.
 * Author: IT23218512
 */

using System.Text;
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

        // Shortest password the API will store.
        public const int MinimumPasswordLength = 8;

        // Bcrypt only uses the first 72 bytes of a password and silently ignores the rest, so anything longer would be partly unprotected.
        // The limit is in UTF-8 bytes, so symbols and non-English letters ( 2–4 bytes each ) reach it sooner than 72 characters.
        public const int MaximumPasswordBytes = 72;

        // Checks a password that is about to be set: registration, change password and the Backoffice resets.
        // Never use this on a password being checked ( login, current password ): older passwords made before these rules must still sign in.
        public static string? ValidateNewPassword(string? password)
        {
            if (string.IsNullOrEmpty(password) || password.Length < MinimumPasswordLength)
            {
                return $"Password must be at least {MinimumPasswordLength} characters.";
            }

            if (password.Any(char.IsWhiteSpace))
            {
                return "Password can't contain spaces.";
            }

            if (Encoding.UTF8.GetByteCount(password) > MaximumPasswordBytes)
            {
                return $"Password is too long. Use at most {MaximumPasswordBytes} characters (fewer if it includes symbols or non-English letters).";
            }

            // Lists every missing kind of character in one message, so the user can fix them all at once.
            var missing = new List<string>();
            if (!password.Any(c => c >= 'A' && c <= 'Z'))
            {
                missing.Add("an uppercase letter");
            }
            if (!password.Any(c => c >= 'a' && c <= 'z'))
            {
                missing.Add("a lowercase letter");
            }
            if (!password.Any(c => c >= '0' && c <= '9'))
            {
                missing.Add("a number");
            }
            if (!password.Any(IsSpecialCharacter))
            {
                missing.Add("a special character");
            }

            if (missing.Count > 0)
            {
                var list = missing.Count == 1
                    ? missing[0]
                    : string.Join(", ", missing.Take(missing.Count - 1)) + " and " + missing[^1];
                return $"Password must include {list}.";
            }

            return null;
        }

        // A special character is anything other than an English letter, a digit or a space, e.g. ! @ # $ % _ -.
        // The web and mobile password checklists use the same definition.
        private static bool IsSpecialCharacter(char c)
        {
            return !(c >= 'A' && c <= 'Z') && !(c >= 'a' && c <= 'z') && !(c >= '0' && c <= '9') && !char.IsWhiteSpace(c);
        }

        // Shortest and longest full name the API accepts. Names are shown in web tables and on mobile cards, so an unbounded one would break those layouts.
        public const int MinimumFullNameLength = 2;
        public const int MaximumFullNameLength = 100;

        // English letters and spaces only: no digits, symbols, dots, apostrophes or hyphens.
        private static readonly Regex FullNamePattern = new(@"^[A-Za-z ]+$", RegexOptions.NonBacktracking);

        // Checks a required full name.
        public static string? ValidateFullName(string? fullName)
        {
            if (string.IsNullOrWhiteSpace(fullName))
            {
                return "Full name is required.";
            }

            var trimmed = fullName.Trim();

            if (trimmed.Length > MaximumFullNameLength)
            {
                return $"Full name must be at most {MaximumFullNameLength} characters.";
            }

            if (!FullNamePattern.IsMatch(trimmed))
            {
                return "Full name can only contain letters and spaces.";
            }

            if (trimmed.Length < MinimumFullNameLength)
            {
                return $"Full name must be at least {MinimumFullNameLength} letters.";
            }

            return null;
        }

        // Longest phone number the API accepts: "+947" and 8 more digits.
        public const int MaximumPhoneLength = 12;

        // A Sri Lankan mobile number, written locally ( 0771234567 ) or internationally ( +94771234567 ), with no spaces or hyphens.
        // [0-9] rather than \d, which in .NET also matches non-English digits.
        private static readonly Regex PhonePattern = new(@"^(07[0-9]{8}|\+947[0-9]{8})$", RegexOptions.NonBacktracking);

        // Checks a required phone number.
        public static string? ValidatePhone(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone))
            {
                return "Phone number is required.";
            }

            if (!PhonePattern.IsMatch(phone.Trim()))
            {
                return "Enter a valid Sri Lankan mobile number: 07XXXXXXXX or +947XXXXXXXX, with no spaces.";
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

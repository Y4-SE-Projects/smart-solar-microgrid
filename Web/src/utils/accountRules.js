/* File: accountRules.js
 * Purpose: The account field rules the web forms check, mirroring the API's AccountRules with the same wording,
 *          and the characters each field accepts, so a character a rule forbids can't be typed or pasted in at all.
 *          The API stays authoritative; this only saves a round trip and puts the message next to the field.
 *          Each check returns the message to show, or null when the value is valid.
 * Author: IT23218512
 */

// USERNAME 

export const MAXIMUM_USERNAME_LENGTH = 50;

// 3–50 characters, a letter first, then letters, digits, ".", "_" or "-".
// Usernames go into URL paths, so "/", "#", "?" and "%" must never appear.
const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{2,49}$/;

export function usernameError(username) {
  const trimmed = username.trim();
  if (!trimmed) return 'Username is required.';
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'Username must be 3–50 characters, start with a letter, and use only letters, numbers, dots, hyphens or underscores.';
  }
  return null;
}

// FULL NAME

export const MINIMUM_FULL_NAME_LENGTH = 2;
export const MAXIMUM_FULL_NAME_LENGTH = 100;

// English letters and spaces only: no digits, symbols, dots, apostrophes or hyphens.
const FULL_NAME_PATTERN = /^[A-Za-z ]+$/;

export function fullNameError(fullName) {
  const trimmed = fullName.trim();
  if (!trimmed) return 'Full name is required.';
  if (trimmed.length > MAXIMUM_FULL_NAME_LENGTH) {
    return `Full name must be at most ${MAXIMUM_FULL_NAME_LENGTH} characters.`;
  }
  if (!FULL_NAME_PATTERN.test(trimmed)) return 'Full name can only contain letters and spaces.';
  if (trimmed.length < MINIMUM_FULL_NAME_LENGTH) {
    return `Full name must be at least ${MINIMUM_FULL_NAME_LENGTH} letters.`;
  }
  return null;
}

// EMAIL 

export const MAXIMUM_EMAIL_LENGTH = 254;

// Something@something.something, with no spaces and a single "@".
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(email) {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  if (trimmed.length > MAXIMUM_EMAIL_LENGTH) return `Email must be at most ${MAXIMUM_EMAIL_LENGTH} characters.`;
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
  return null;
}

// PHONE 

// A local number ( 0771234567 ) is 10 characters; an international one ( +94771234567 ) is 12.
const LOCAL_PHONE_LENGTH = 10;
const INTERNATIONAL_PHONE_LENGTH = 12;

// A Sri Lankan mobile number, written locally or internationally, with no spaces or hyphens.
const PHONE_PATTERN = /^(07[0-9]{8}|\+947[0-9]{8})$/;

export function phoneError(phone) {
  const trimmed = phone.trim();
  if (!trimmed) return 'Phone number is required.';
  if (!PHONE_PATTERN.test(trimmed)) {
    return 'Enter a valid Sri Lankan mobile number: 07XXXXXXXX or +947XXXXXXXX, with no spaces.';
  }
  return null;
}

// NEW PASSWORD 

export const MINIMUM_PASSWORD_LENGTH = 8;

// Bcrypt only uses the first 72 bytes of a password.
// Inputs stop at 72 characters as a guide; the byte count below also catches symbols and non-English letters, which take 2–4 bytes each.
export const MAXIMUM_PASSWORD_BYTES = 72;

// Anything other than an English letter, a digit or a space, e.g. ! @ # $ % _ -. Same definition as the API.
function isSpecialCharacter(character) {
  return !/[A-Za-z0-9\s]/.test(character);
}

// Each requirement of a new password and whether it is met yet, for the live checklist under the field.
// Spaces aren't listed. The password inputs don't accept them.
export function passwordChecks(password) {
  const byteCount = new TextEncoder().encode(password).length;
  return [
    {
      label: `${MINIMUM_PASSWORD_LENGTH}–${MAXIMUM_PASSWORD_BYTES} characters`,
      met: password.length >= MINIMUM_PASSWORD_LENGTH && byteCount <= MAXIMUM_PASSWORD_BYTES,
    },
    { label: 'An uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', met: /[a-z]/.test(password) },
    { label: 'A number', met: /[0-9]/.test(password) },
    { label: 'A special character (e.g. ! @ # $)', met: [...password].some(isSpecialCharacter) },
  ];
}

// Returns the message for a password that is about to be set, or null when it is acceptable.
export function newPasswordError(password) {
  if (!password || password.length < MINIMUM_PASSWORD_LENGTH) {
    return `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  }
  if (/\s/.test(password)) return "Password can't contain spaces.";
  if (new TextEncoder().encode(password).length > MAXIMUM_PASSWORD_BYTES) {
    return `Password is too long. Use at most ${MAXIMUM_PASSWORD_BYTES} characters (fewer if it includes symbols or non-English letters).`;
  }

  // Lists every missing kind of character in one message, so they can all be fixed at once.
  const missing = [];
  if (!/[A-Z]/.test(password)) missing.push('an uppercase letter');
  if (!/[a-z]/.test(password)) missing.push('a lowercase letter');
  if (!/[0-9]/.test(password)) missing.push('a number');
  if (![...password].some(isSpecialCharacter)) missing.push('a special character');
  if (missing.length > 0) {
    const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}`;
    return `Password must include ${list}.`;
  }
  return null;
}

// ---------- Characters each field accepts ----------

// Applied to the whole value on every change; so a forbidden character typed or pasted in, never appears.
// These only remove characters; whether the result is complete ( long enough, the right prefix ) is the checks' job above.
export const allowedInput = {
  // Usernames are stored in lower case, so they are shown that way as they are typed.
  username: (value) => value.toLowerCase().replace(/[^a-z0-9._-]/g, ''),

  // Letters and single spaces between words.
  fullName: (value) => value.replace(/[^A-Za-z ]/g, '').replace(/ {2,}/g, ' '),

  email: (value) => value.replace(/\s/g, ''),

  // Digits, with a "+" allowed only as the first character. 
  // Stops at the longest valid number for the format being typed, so pasting "+94 77 123 4567" gives "+94771234567".
  phone: (value) => {
    const hasPlus = value.trimStart().startsWith('+');
    const digits = value.replace(/[^0-9]/g, '');
    return ((hasPlus ? '+' : '') + digits).slice(0, hasPlus ? INTERNATIONAL_PHONE_LENGTH : LOCAL_PHONE_LENGTH);
  },

  password: (value) => value.replace(/\s/g, ''),
};

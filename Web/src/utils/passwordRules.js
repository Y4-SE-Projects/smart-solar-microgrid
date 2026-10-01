/* File: passwordRules.js
 * Purpose: The rule for a password that is about to be set, shared by the staff form and the staff password reset.
 *          Mirrors the API's AccountRules.ValidateNewPassword with the same wording. 
 *          The API stays authoritative; this only saves a round trip and puts the message next to the field.
 * Author: IT23218512
*/

export const MINIMUM_PASSWORD_LENGTH = 8;

// Bcrypt only uses the first 72 bytes of a password. 
// Inputs stop at 72 characters as a guide; the byte check below also catches symbols and non-English letters, which take 2–4 bytes each.
export const MAXIMUM_PASSWORD_BYTES = 72;

// Returns the message for a new password, or null when it is acceptable.
// Never use this on a password being checked (sign-in), only on one being set.
export function newPasswordError(password) {
  if (!password || password.length < MINIMUM_PASSWORD_LENGTH) {
    return `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  }

  if (!password.trim()) {
    return "Password can't be only spaces.";
  }

  if (new TextEncoder().encode(password).length > MAXIMUM_PASSWORD_BYTES) {
    return `Password is too long. Use at most ${MAXIMUM_PASSWORD_BYTES} characters (fewer if it includes symbols or non-English letters).`;
  }

  return null;
}

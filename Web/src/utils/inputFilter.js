/* File: inputFilter.js
 * Purpose: Applies one of accountRules' allowedInput filters to an input as it changes, keeping the caret where the user was typing.
 * Author: IT23218512
 */

// Returns the input's value with the filter applied, for the onChange handler to store.
// When characters are removed, the input is updated here first with the caret placed back where it was.
// Otherwise React would set the shorter value itself and jump the caret to the end.
export function filteredValue(event, filter) {
  const input = event.target;
  const raw = input.value;
  const cleaned = filter(raw);
  if (cleaned === raw) return raw;

  // Null for type="email", which has no caret position to restore.
  const caret = input.selectionStart;
  input.value = cleaned;
  if (caret !== null) {
    const position = filter(raw.slice(0, caret)).length;
    input.setSelectionRange(position, position);
  }
  return cleaned;
}

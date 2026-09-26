/* File: formatters.js
 * Purpose: Small display helpers shared by the account-management screens.
 *          These are only shape values for rendering. No business rules live here, since those belong to the API.
 * Author: IT23218512
*/


// Builds a two-letter avatar label from a full name ("Kasun Perera" -> "KP").
// Falls back to a dash pair, so an avatar circle never renders empty.
export function getInitials(fullName) {
  if (!fullName) return '--';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '--';
}

// Formats an API timestamp for display. 
// Returns a dash for null or invalid values rather than "Invalid Date". 
// Several date fields are only populated once an account has been deactivated.
export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// True when the timestamp falls within the current calendar month.
export function isThisMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

// Pluralises a unit against a count ("1 day" / "3 days").
export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
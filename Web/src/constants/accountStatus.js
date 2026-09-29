/* File: accountStatus.js
 * Purpose: Single source of truth for the 3 account-status values the API returns, mirroring API/Models/AccountStatus.cs exactly.
 *          The strings must match the API's byte-for-byte, since they arrive on every account response and get compared against these constants.
 * Author: IT23218512
 */

export const AccountStatus = {
  Active: 'Active',
  Deactivated: 'Deactivated',
  PendingReactivation: 'PendingReactivation',
};

// Reads an account's status, falling back to deriving it from the underlying flags.
// The API computes `status` server-side and that is the value to trust. 
// Th e fallback only matters if a response predates that field, so a stale API never leaves rows with no status at all.
export function resolveAccountStatus(account) {
  if (account?.status) return account.status;
  if (account?.isActive) return AccountStatus.Active;
  return account?.reactivationRequestedAt
    ? AccountStatus.PendingReactivation
    : AccountStatus.Deactivated;
}
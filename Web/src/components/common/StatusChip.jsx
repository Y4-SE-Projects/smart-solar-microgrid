/* File: StatusChip.jsx
 * Purpose: Account status pill driven by the API's `isActive` flag.
 * Author: IT23218512
 */

export default function StatusChip({ isActive }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-surface text-primary-container text-body-sm font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
        <span>Active</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-body-sm font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-outline" />
      <span>Deactivated</span>
    </span>
  );
}
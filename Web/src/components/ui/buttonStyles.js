// File: buttonStyles.js
// Purpose: Shared Tailwind class strings for the compact dialog/action buttons.

const BASE =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const PRIMARY_BUTTON = `${BASE} bg-primary-container text-on-primary shadow-sm hover:bg-primary disabled:hover:bg-primary-container`;

export const SECONDARY_BUTTON = `${BASE} text-on-surface-variant hover:bg-on-surface/6 hover:text-on-surface`;

export const DANGER_BUTTON = `${BASE} bg-alert-danger text-on-error shadow-sm hover:bg-error focus-visible:ring-alert-danger`;

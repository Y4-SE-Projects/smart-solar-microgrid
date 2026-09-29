/* File: roles.js
 * Purpose: Single source of truth for the 3 exact role string values used across the Web app.
 * The strings must match the API's values.
 */

export const Roles = {
  Backoffice: 'Backoffice',
  GridOperator: 'GridOperator',
  Prosumer: 'Prosumer',
};

// Where a role lands after signing in, and where it gets sent back to if it isn't allowed. 

// Returns null for a role with no place in the console. ( Prosumers - mobile-only, and anything this build doesn't recognise. ) 
export function homePathForRole(role) {
  switch (role) {
    case Roles.Backoffice:
      return '/stations';
    case Roles.GridOperator:
      return '/schedules';
    default:
      return null;
  }
}
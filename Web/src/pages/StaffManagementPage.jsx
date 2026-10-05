/* File: StaffManagementPage.jsx
 * Purpose: Backoffice screen for creating and administering staff accounts — the Backoffice and Grid Operator users who can sign in to the console.
 *          Handles orchestration only - loading the staff list, holding the account being acted on, sending the request and reporting the result.
 *
 * Author: IT23218512
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getStaff,
  registerUser,
  updateStaff,
  deactivateStaff,
  reactivateStaff,
  resetStaffPassword,
} from '../services/usersApi';
import { Roles } from '../constants/roles';
import { useAuth } from '../context/AuthContext';
import MetricCard from '../components/common/MetricCard';
import PolicyBanner from '../components/common/PolicyBanner';
import StaffForm from '../components/staff/StaffForm';
import StaffDirectory from '../components/staff/StaffDirectory';
import StaffStatusDialog from '../components/staff/StaffStatusDialog';
import StaffPasswordDialog from '../components/staff/StaffPasswordDialog';

export default function StaffManagementPage() {
  // The signed-in user's identifier is their username for staff accounts. 
  // It's what lets the directory mark their own row and keep them from disabling themselves.
  const { identifier: currentUsername } = useAuth();

  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // The account being acted on, plus which action was chosen. 
  // Holding both together means only one dialog can be open at a time, and cancelling clears the pair.
  const [action, setAction] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setStaff(await getStaff());
    } catch (error) {
      // A 401 is handled globally by the Axios interceptor, which clears the session and redirects to login; anything else lands here.
      // A failed load is reported by the directory itself, which offers its own Retry, so it stays out of the toasts that carry action outcomes.
      setLoadError(error.response?.data?.message || 'Could not load staff accounts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const totalCount = staff.length;
  const backofficeCount = staff.filter((member) => member.role === Roles.Backoffice).length;
  const operatorCount = staff.filter((member) => member.role === Roles.GridOperator).length;

  // Every action follows the same shape.
  // ( send it, report the outcome in a toast, reload the directory so the row and the metrics move together. )
  // The dialog stays open on failure, so a rejected change can be corrected without retyping.
  async function runAction(request, describeSuccess) {
    setIsSubmitting(true);
    try {
      await request();
      toast.success(describeSuccess());
      setAction(null);
      await loadStaff();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not complete this action. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCreateStaff(payload) {
    runAction(
      () => registerUser(payload),
      () => `${payload.fullName}'s account has been created.`
    );
  }

  function handleUpdateStaff(payload) {
    if (!action?.member) return;
    const { member } = action;
    runAction(
      () => updateStaff(member.username, payload),
      () => `${member.username}'s details have been updated.`
    );
  }

  function handleConfirmStatus() {
    if (!action?.member) return;
    const { member, mode } = action;
    const isDeactivating = mode === 'deactivate';
    runAction(
      () => (isDeactivating ? deactivateStaff(member.username) : reactivateStaff(member.username)),
      () =>
        isDeactivating
          ? `${member.username}'s access has been disabled.`
          : `${member.username}'s access has been restored.`
    );
  }

  function handleConfirmPassword(newPassword) {
    if (!action?.member) return;
    const { member } = action;
    runAction(
      () => resetStaffPassword(member.username, newPassword),
      () => `${member.username}'s password has been reset.`
    );
  }

  function openAction(mode, member = null) {
    setAction({ member, mode });
  }

  function handleOpenCreate() {
    openAction('create');
  }

  function handleCancelAction() {
    setAction(null);
  }

  const isFormOpen = action?.mode === 'create' || action?.mode === 'edit';
  const isStatusDialogOpen = action?.mode === 'deactivate' || action?.mode === 'reactivate';

  return (
    <div className="flex flex-col gap-6">

      {/* Title and primary action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-headline-lg font-bold text-primary tracking-tight">
            Staff Account Management
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Create and administer the Backoffice and Grid Operator accounts that can access the
            console.
          </p>
        </div>
        {!isFormOpen && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container shadow-sm text-body-sm font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Add Staff Account</span>
          </button>
        )}
      </div>

      {/* Rules this screen operates under */}
      <PolicyBanner title="Account Policy">
        Only a signed-in Backoffice user can create or administer Backoffice and Grid Operator accounts, and 
        usernames must be unique. Cannot disable signed-in account, and the last active Backoffice account 
        cannot be disabled at all. 
      </PolicyBanner>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <MetricCard
          label="Total Staff"
          value={isLoading ? '—' : totalCount}
          note="Accounts on record"
          icon="badge"
          iconBgClass="bg-mint-surface text-primary"
        />
        <MetricCard
          label="Backoffice"
          value={isLoading ? '—' : backofficeCount}
          note="Full administrative access"
          icon="admin_panel_settings"
          iconBgClass="bg-secondary-container text-primary-container"
        />
        <MetricCard
          label="Grid Operators"
          value={isLoading ? '—' : operatorCount}
          note="Web and mobile access"
          icon="engineering"
          iconBgClass="bg-yellow-container text-on-yellow"
        />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="staff-directory-heading">
        <h2 id="staff-directory-heading" className="text-headline-sm font-semibold text-on-surface">
          Staff Directory
        </h2>
        <StaffDirectory
          staff={staff}
          isLoading={isLoading}
          loadError={loadError}
          onRetry={loadStaff}
          currentUsername={currentUsername}
          onEdit={(member) => openAction('edit', member)}
          onResetPassword={(member) => openAction('password', member)}
          onToggleStatus={(member, mode) => openAction(mode, member)}
        />
      </section>

      {isFormOpen && (
        <StaffForm
          mode={action.mode}
          member={action.member}
          isSubmitting={isSubmitting}
          onSubmit={action.mode === 'edit' ? handleUpdateStaff : handleCreateStaff}
          onCancel={handleCancelAction}
        />
      )}

      {isStatusDialogOpen && (
        <StaffStatusDialog
          member={action.member}
          mode={action.mode}
          isSubmitting={isSubmitting}
          onConfirm={handleConfirmStatus}
          onCancel={handleCancelAction}
        />
      )}

      <StaffPasswordDialog
        member={action?.mode === 'password' ? action.member : null}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmPassword}
        onCancel={handleCancelAction}
      />
    </div>
  );
}

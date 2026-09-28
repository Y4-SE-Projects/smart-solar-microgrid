/* File: StaffManagementPage.jsx
 * Purpose: Backoffice screen for creating and administering staff accounts — the Backoffice and Grid Operator users who can sign in to the console.
 *          Handles orchestration only - loading the staff list, holding the account being acted on, sending the request and reporting the result.
 *
 * Author: IT23218512
 */

import { useState, useEffect, useCallback } from 'react';
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
import AlertBanner from '../components/common/AlertBanner';
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
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setStaff(await getStaff());
    } catch (error) {
      // A 401 is handled globally by the Axios interceptor, which clears the session and redirects to login; anything else lands here.
      setLoadError(
        error.response?.data?.message || 'Could not load staff accounts. Please try again.'
      );
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
  // ( send it, report the outcome, reload the directory so the row and the metrics move together. )
  // The dialog stays open on failure, so a rejected change can be corrected without retyping.
  async function runAction(request, describeSuccess) {
    setIsSubmitting(true);
    setActionError('');
    try {
      const result = await request();
      setSuccessMessage(result?.message || describeSuccess());
      setAction(null);
      await loadStaff();
    } catch (error) {
      setActionError(
        error.response?.data?.message || 'Could not complete this action. Please try again.'
      );
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
    setActionError('');
    setAction({ member, mode });
  }

  function handleOpenCreate() {
    setSuccessMessage('');
    openAction('create');
  }

  function handleCancelAction() {
    setAction(null);
    setActionError('');
  }

  const isFormOpen = action?.mode === 'create' || action?.mode === 'edit';
  const isStatusDialogOpen = action?.mode === 'deactivate' || action?.mode === 'reactivate';

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <span className="text-outline">Operations</span>
          <span>/</span>
          <span className="text-outline">Identity &amp; Access</span>
          <span>/</span>
          <span className="text-on-surface font-medium">Staff Accounts</span>
        </nav>
        <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-body-sm font-semibold">
          <span className="material-symbols-outlined text-[15px] text-secondary">shield_person</span>
          <span>Backoffice-only administration</span>
        </span>
      </div>

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

      <AlertBanner
        variant="success"
        message={successMessage}
        onDismiss={() => setSuccessMessage('')}
      />

      <AlertBanner variant="error" message={loadError} actionLabel="Retry" onAction={loadStaff} />

      {/* Rules this screen operates under */}
      <div className="p-5 rounded-2xl bg-surface-container-low/70 border border-border-slate flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-surface-container-highest text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px] text-secondary">gavel</span>
          </div>
          <div className="flex flex-col">
            <span className="text-title-md text-primary font-semibold">Account Policy</span>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Only a signed-in Backoffice user can create or administer Backoffice and Grid
              Operator accounts, and usernames must be unique. You cannot disable your own
              account, and the last active Backoffice account cannot be disabled at all.
              Prosumers are not managed here — they register themselves from the mobile app using
              their NIC.
            </p>
          </div>
        </div>
        <span className="self-start sm:self-center shrink-0 px-3 py-1 rounded-full bg-surface-container-lowest border border-border-slate text-secondary text-label-sm font-semibold uppercase">
          Enforced by API
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <MetricCard
          label="Total Staff"
          value={isLoading ? '—' : totalCount}
          note="Accounts on record"
          icon="badge"
        />
        <MetricCard
          label="Backoffice"
          value={isLoading ? '—' : backofficeCount}
          note="Full administrative access"
          icon="admin_panel_settings"
        />
        <MetricCard
          label="Grid Operators"
          value={isLoading ? '—' : operatorCount}
          note="Web and mobile access"
          icon="engineering"
        />
      </div>

      <StaffDirectory
        staff={staff}
        isLoading={isLoading}
        currentUsername={currentUsername}
        onEdit={(member) => openAction('edit', member)}
        onResetPassword={(member) => openAction('password', member)}
        onToggleStatus={(member, mode) => openAction(mode, member)}
      />

      {isFormOpen && (
        <StaffForm
          mode={action.mode}
          member={action.member}
          isSubmitting={isSubmitting}
          error={actionError}
          onSubmit={action.mode === 'edit' ? handleUpdateStaff : handleCreateStaff}
          onCancel={handleCancelAction}
        />
      )}

      {isStatusDialogOpen && (
        <StaffStatusDialog
          member={action.member}
          mode={action.mode}
          isSubmitting={isSubmitting}
          error={actionError}
          onConfirm={handleConfirmStatus}
          onCancel={handleCancelAction}
        />
      )}

      <StaffPasswordDialog
        member={action?.mode === 'password' ? action.member : null}
        isSubmitting={isSubmitting}
        error={actionError}
        onConfirm={handleConfirmPassword}
        onCancel={handleCancelAction}
      />
    </div>
  );
}
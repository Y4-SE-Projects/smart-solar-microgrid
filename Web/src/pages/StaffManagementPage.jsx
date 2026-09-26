/* File: StaffManagementPage.jsx
 * Purpose: Backoffice screen for creating and reviewing staff accounts — the Backoffice and Grid Operator users who can sign in to the console.
 *          Handles orchestration only - Loading staff list, opening create form, submitting registration and reporting result.
 *
 * Author: IT23218512
 */

import { useState, useEffect, useCallback } from 'react';
import { getStaff, registerUser } from '../services/usersApi';
import { Roles } from '../constants/roles';
import MetricCard from '../components/common/MetricCard';
import AlertBanner from '../components/common/AlertBanner';
import StaffForm from '../components/staff/StaffForm';
import StaffDirectory from '../components/staff/StaffDirectory';

export default function StaffManagementPage() {
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
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

  // Creates the account, then reloads the directory so the new row and the metrics update together. 
  // The form closes on success and stays open on failure, so a rejected username can be corrected without retyping.
  async function handleCreateStaff(payload) {
    setIsCreating(true);
    setCreateError('');
    try {
      const result = await registerUser(payload);
      setSuccessMessage(
        result?.message || `${payload.fullName}'s account has been created.`
      );
      setIsFormOpen(false);
      await loadStaff();
    } catch (error) {
      setCreateError(
        error.response?.data?.message || 'Could not create this account. Please try again.'
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenForm() {
    setCreateError('');
    setSuccessMessage('');
    setIsFormOpen(true);
  }

  function handleCancelForm() {
    setIsFormOpen(false);
    setCreateError('');
  }

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
            Create and review the Backoffice and Grid Operator accounts that can access the console.
          </p>
        </div>
        {!isFormOpen && (
          <button
            type="button"
            onClick={handleOpenForm}
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
              Only a signed-in Backoffice user can create Backoffice or Grid Operator accounts, and
              usernames must be unique. Prosumer accounts are not created here — prosumers register
              themselves from the mobile app using their NIC.
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
          note="Accounts with console access"
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

      {isFormOpen && (
        <StaffForm
          isSubmitting={isCreating}
          error={createError}
          onSubmit={handleCreateStaff}
          onCancel={handleCancelForm}
        />
      )}

      <StaffDirectory staff={staff} isLoading={isLoading} />
    </div>
  );
}
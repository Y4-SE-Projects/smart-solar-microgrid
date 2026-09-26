/* File: ProsumerManagementPage.jsx
 * Purpose: Backoffice screen for reviewing solar prosumer accounts and processing reactivation requests.
 *          This file handles orchestration only.
 *          ( loading the account data, holding the account selected for reactivation, 
 *          sending that request and reporting the result. ) 
 * Author: IT23218512
 */

import { useState, useEffect, useCallback } from 'react';
import { getProsumers, getPendingDeactivation, reactivateProsumer } from '../services/usersApi';
import { isThisMonth } from '../utils/formatters';
import MetricCard from '../components/common/MetricCard';
import AlertBanner from '../components/common/AlertBanner';
import ReactivationQueue from '../components/prosumers/ReactivationQueue';
import ProsumerDirectory from '../components/prosumers/ProsumerDirectory';
import ReactivateDialog from '../components/prosumers/ReactivateDialog';

export default function ProsumerManagementPage() {
  const [prosumers, setProsumers] = useState([]);
  const [pending, setPending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedProsumer, setSelectedProsumer] = useState(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Loads both lists together, on mount and again after a successful reactivation. 
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [allProsumers, pendingAccounts] = await Promise.all([
        getProsumers(),
        getPendingDeactivation(),
      ]);
      setProsumers(allProsumers);
      setPending(pendingAccounts);
    } catch (error) {
      // A 401 is already handled globally by the Axios interceptor, which clears the session and redirects to login; anything else lands here.
      setLoadError(
        error.response?.data?.message || 'Could not load prosumer accounts. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Counted from the accounts already fetched rather than a separate stats endpoint, so the figures always agree with the rows on screen.
  const totalCount = prosumers.length;
  const activeCount = prosumers.filter((prosumer) => prosumer.isActive).length;
  const activeRatio = totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) : '0.0';
  const newThisMonth = prosumers.filter((prosumer) => isThisMonth(prosumer.createdAt)).length;

  // Sends the reactivation, then reloads both lists; so the account leaves the queue; and its directory row flips to Active.
  async function handleConfirmReactivate() {
    if (!selectedProsumer) return;
    setIsReactivating(true);
    setActionError('');
    try {
      const result = await reactivateProsumer(selectedProsumer.nic);
      setSuccessMessage(
        result?.message || `${selectedProsumer.fullName}'s account has been reactivated.`
      );
      setSelectedProsumer(null);
      await loadAccounts();
    } catch (error) {
      // The dialog stays open on failure so the action can be retried without finding the account again.
      setActionError(
        error.response?.data?.message || 'Could not reactivate this account. Please try again.'
      );
    } finally {
      setIsReactivating(false);
    }
  }

  function handleSelectProsumer(prosumer) {
    setActionError('');
    setSelectedProsumer(prosumer);
  }

  function handleCancelReactivate() {
    setSelectedProsumer(null);
    setActionError('');
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb and identifier policy note */}
      <div className="flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <span className="text-outline">Operations</span>
          <span>/</span>
          <span className="text-outline">Identity &amp; Access</span>
          <span>/</span>
          <span className="text-on-surface font-medium">Prosumer Management</span>
        </nav>
        <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-body-sm font-semibold">
          <span className="material-symbols-outlined text-[15px] text-secondary">verified_user</span>
          <span>NIC enforced as primary identifier</span>
        </span>
      </div>

      <div className="flex flex-col">
        <h1 className="text-headline-lg font-bold text-primary tracking-tight">
          Prosumer User Management
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Review registered solar prosumers, account statuses, and process reactivation requests.
        </p>
      </div>

      <AlertBanner
        variant="success"
        message={successMessage}
        onDismiss={() => setSuccessMessage('')}
      />

      <AlertBanner
        variant="error"
        message={loadError}
        actionLabel="Retry"
        onAction={loadAccounts}
      />

      {/* Rules this screen operates under */}
      <div className="p-5 rounded-2xl bg-surface-container-low/70 border border-border-slate flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-surface-container-highest text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px] text-secondary">gavel</span>
          </div>
          <div className="flex flex-col">
            <span className="text-title-md text-primary font-semibold">Account Policy</span>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Prosumers register using their National Identity Card (NIC) as the primary identifier.
              Accounts are deactivated by the prosumer from the mobile app, and only a Backoffice
              user can reactivate them.
            </p>
          </div>
        </div>
        <span className="self-start sm:self-center shrink-0 px-3 py-1 rounded-full bg-surface-container-lowest border border-border-slate text-secondary text-label-sm font-semibold uppercase">
          Enforced by API
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <MetricCard
          label="Total Prosumers"
          value={isLoading ? '—' : totalCount}
          caption={!isLoading && newThisMonth > 0 ? `+${newThisMonth} this mo` : null}
          note="Registered solar accounts"
          icon="groups"
        />
        <MetricCard
          label="Active Prosumers"
          value={isLoading ? '—' : activeCount}
          caption={!isLoading && totalCount > 0 ? `${activeRatio}% of total` : null}
          note="Able to sign in and trade"
          icon="bolt"
        />
        <MetricCard
          label="Pending Reactivations"
          value={isLoading ? '—' : pending.length}
          note="Only Backoffice can reactivate"
          emphasis
        />
      </div>

      <ReactivationQueue
        pending={pending}
        isLoading={isLoading}
        onReactivate={handleSelectProsumer}
      />

      <ProsumerDirectory
        prosumers={prosumers}
        isLoading={isLoading}
        onReactivate={handleSelectProsumer}
      />

      <ReactivateDialog
        prosumer={selectedProsumer}
        isSubmitting={isReactivating}
        error={actionError}
        onConfirm={handleConfirmReactivate}
        onCancel={handleCancelReactivate}
      />
    </div>
  );
}
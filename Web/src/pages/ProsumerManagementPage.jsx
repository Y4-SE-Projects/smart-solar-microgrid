/* File: ProsumerManagementPage.jsx
 * Purpose: Backoffice screen for reviewing solar prosumer accounts and processing reactivation requests.
 *          This file handles orchestration only.
 *          ( loading the account data, holding the account selected for an action,
 *          sending that request and reporting the result. )
 * Author: IT23218512
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getProsumers,
  getReactivationRequests,
  reactivateProsumer,
  rejectReactivation,
} from '../services/usersApi';
import { isThisMonth } from '../utils/formatters';
import { AccountStatus, resolveAccountStatus } from '../constants/accountStatus';
import MetricCard from '../components/common/MetricCard';
import AlertBanner from '../components/common/AlertBanner';
import ReactivationQueue from '../components/prosumers/ReactivationQueue';
import ProsumerDirectory from '../components/prosumers/ProsumerDirectory';
import ReactivateDialog from '../components/prosumers/ReactivateDialog';
import RejectDialog from '../components/prosumers/RejectDialog';

export default function ProsumerManagementPage() {
  const [prosumers, setProsumers] = useState([]);
  const [pending, setPending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // The account being acted on, plus which action was chosen. 
  // Holding both together means only one dialog can ever be open, and cancelling clears the pair.
  const [action, setAction] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Loads both lists together, on mount and again after a successful action.
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [allProsumers, pendingAccounts] = await Promise.all([
        getProsumers(),
        getReactivationRequests(),
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
    let cancelled = false;
    Promise.all([getProsumers(), getReactivationRequests()])
      .then(([allProsumers, pendingAccounts]) => {
        if (!cancelled) {
          setProsumers(allProsumers);
          setPending(pendingAccounts);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.response?.data?.message || 'Could not load prosumer accounts. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Counted from the accounts already fetched rather than a separate stats endpoint, so the figures always agree with the rows on screen.
  const totalCount = prosumers.length;
  const activeCount = prosumers.filter(
    (prosumer) => resolveAccountStatus(prosumer) === AccountStatus.Active
  ).length;
  const activeRatio = totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) : '0.0';
  const newThisMonth = prosumers.filter((prosumer) => isThisMonth(prosumer.createdAt)).length;

  // Both actions follow the same shape. 
  // Send it, report the outcome, reload both lists; so the queue, the directory row and the metrics move together.
  async function runAction(request, describeSuccess) {
    setIsSubmitting(true);
    setActionError('');
    try {
      const result = await request();
      setSuccessMessage(result?.message || describeSuccess());
      setAction(null);
      await loadAccounts();
    } catch (error) {
      // The dialog stays open on failure so the action can be retried without finding the account again.
      setActionError(
        error.response?.data?.message || 'Could not complete this action. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleConfirmReactivate() {
    if (!action) return;
    const { prosumer } = action;
    runAction(
      () => reactivateProsumer(prosumer.nic),
      () => `${prosumer.fullName}'s account has been reactivated.`
    );
  }

  function handleConfirmReject(reason) {
    if (!action) return;
    const { prosumer } = action;
    runAction(
      () => rejectReactivation(prosumer.nic, reason),
      () => `${prosumer.fullName}'s reactivation request has been declined.`
    );
  }

  function handleSelectProsumer(prosumer) {
    setActionError('');
    setAction({ prosumer, mode: 'reactivate' });
  }

  function handleRejectProsumer(prosumer) {
    setActionError('');
    setAction({ prosumer, mode: 'reject' });
  }

  function handleCancelAction() {
    setAction(null);
    setActionError('');
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg font-bold tracking-tight text-primary">Prosumer Accounts</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Review account activity and reactivation requests.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <MetricCard
          label="Total Prosumers"
          value={isLoading ? '—' : totalCount}
          caption={!isLoading && newThisMonth > 0 ? `+${newThisMonth} this month` : null}
          note="Registered solar accounts"
          icon="groups"
          iconBgClass="bg-mint-surface text-primary"
        />
        <MetricCard
          label="Active Prosumers"
          value={isLoading ? '—' : activeCount}
          caption={!isLoading && totalCount > 0 ? `${activeRatio}% of total` : null}
          note="Able to sign in and trade"
          icon="bolt"
          iconBgClass="bg-secondary-container text-primary-container"
        />
        <MetricCard
          label="Pending Reactivations"
          value={isLoading ? '—' : pending.length}
          note="Awaiting your review"
          icon="pending_actions"
          iconBgClass="bg-red-container text-on-red"
        />
      </div>

      <ReactivationQueue
        key={pending.map((account) => account.nic).join('|')}
        pending={pending}
        isLoading={isLoading}
        loadError={loadError}
        onReactivate={handleSelectProsumer}
        onReject={handleRejectProsumer}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-headline-sm font-semibold text-on-surface">Prosumer Directory</h2>
        <ProsumerDirectory
          prosumers={prosumers}
          isLoading={isLoading}
          loadError={loadError}
          onReactivate={handleSelectProsumer}
        />
      </section>

      <ReactivateDialog
        prosumer={action?.mode === 'reactivate' ? action.prosumer : null}
        isSubmitting={isSubmitting}
        error={actionError}
        onConfirm={handleConfirmReactivate}
        onCancel={handleCancelAction}
      />

      <RejectDialog
        prosumer={action?.mode === 'reject' ? action.prosumer : null}
        isSubmitting={isSubmitting}
        error={actionError}
        onConfirm={handleConfirmReject}
        onCancel={handleCancelAction}
      />
    </div>
  );
}

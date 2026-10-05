/* File: ProsumerManagementPage.jsx
 * Purpose: Backoffice screen for reviewing solar prosumer accounts and processing reactivation requests.
 *          Backoffice can also deactivate a prosumer and reset a prosumer's password from the directory.
 *          This file handles orchestration only.
 *          ( loading the account data, holding the account selected for an action, sending that request and reporting the result. )
 * 
 * Author: IT23218512
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  deactivateProsumer,
  getProsumers,
  getReactivationRequests,
  reactivateProsumer,
  rejectReactivation,
  resetProsumerPassword,
} from '../services/usersApi';
import { isThisMonth } from '../utils/formatters';
import { AccountStatus, resolveAccountStatus } from '../constants/accountStatus';
import MetricCard from '../components/common/MetricCard';
import PolicyBanner from '../components/common/PolicyBanner';
import ReactivationQueue from '../components/prosumers/ReactivationQueue';
import ProsumerDirectory from '../components/prosumers/ProsumerDirectory';
import ReactivateDialog from '../components/prosumers/ReactivateDialog';
import RejectDialog from '../components/prosumers/RejectDialog';
import DeactivateProsumerDialog from '../components/prosumers/DeactivateProsumerDialog';
import ProsumerPasswordDialog from '../components/prosumers/ProsumerPasswordDialog';

export default function ProsumerManagementPage() {
  const [prosumers, setProsumers] = useState([]);
  const [pending, setPending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // The account being acted on, plus which action was chosen. 
  // Holding both together means only one dialog can ever be open, and cancelling clears the pair.
  const [action, setAction] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // A failed load is reported by the queue and the directory, each offering its own
      // Retry, so it stays out of the toasts that carry action outcomes.
      setLoadError(error.response?.data?.message || 'Could not load prosumer accounts. Please try again.');
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

  // Every action follows the same shape. 
  // Send it, report the outcome, reload both lists; so the queue, the directory row and the metrics move together.
  async function runAction(request, describeSuccess) {
    setIsSubmitting(true);
    try {
      await request();
      toast.success(describeSuccess());
      setAction(null);
      await loadAccounts();
    } catch (error) {
      // The dialog stays open on failure so the action can be retried without finding the account again.
      // The toast carries the reason, so the dialog itself says nothing about it.
      toast.error(error.response?.data?.message || 'Could not complete this action. Please try again.');
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

  function handleConfirmDeactivate(reason) {
    // Deactivates the selected prosumer; the reason is optional and stored with the account
    if (!action) return;
    const { prosumer } = action;
    runAction(
      () => deactivateProsumer(prosumer.nic, reason),
      () => `${prosumer.fullName}'s account has been deactivated.`
    );
  }

  function handleConfirmResetPassword(newPassword) {
    // Sets the new password; nothing is sent to the prosumer, so the officer passes it on
    if (!action) return;
    const { prosumer } = action;
    runAction(
      () => resetProsumerPassword(prosumer.nic, newPassword),
      () => `${prosumer.fullName}'s password has been reset. Share the new password with them.`
    );
  }

  function handleSelectProsumer(prosumer) {
    setAction({ prosumer, mode: 'reactivate' });
  }

  function handleRejectProsumer(prosumer) {
    setAction({ prosumer, mode: 'reject' });
  }

  function handleDeactivateProsumer(prosumer) {
    setAction({ prosumer, mode: 'deactivate' });
  }

  function handleResetProsumerPassword(prosumer) {
    setAction({ prosumer, mode: 'password' });
  }

  function handleCancelAction() {
    setAction(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg font-bold tracking-tight text-primary">Prosumer Accounts</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Review account activity and reactivation requests.
        </p>
      </div>

      {/* Rules this screen operates under */}
      <PolicyBanner title="Prosumer Account Policy">
        Prosumers register themselves from the mobile app, so prosumer accounts are not created here. 
        A signed-in Backoffice user can reset a prosumer&apos;s password and deactivate or reactivate their 
        account. A deactivated prosumer require a Backoffice user to reactivate them.
      </PolicyBanner>

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
        onRetry={loadAccounts}
        onReactivate={handleSelectProsumer}
        onReject={handleRejectProsumer}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-headline-sm font-semibold text-on-surface">Prosumer Directory</h2>
        <ProsumerDirectory
          prosumers={prosumers}
          isLoading={isLoading}
          loadError={loadError}
          onRetry={loadAccounts}
          onReactivate={handleSelectProsumer}
          onResetPassword={handleResetProsumerPassword}
          onDeactivate={handleDeactivateProsumer}
        />
      </section>

      <ReactivateDialog
        prosumer={action?.mode === 'reactivate' ? action.prosumer : null}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmReactivate}
        onCancel={handleCancelAction}
      />

      {/* key starts each reason dialog fresh for every account, so typed text never carries over to another prosumer. */}
      <RejectDialog
        key={`reject-${action?.prosumer?.nic}`}
        prosumer={action?.mode === 'reject' ? action.prosumer : null}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmReject}
        onCancel={handleCancelAction}
      />

      <DeactivateProsumerDialog
        key={`deactivate-${action?.prosumer?.nic}`}
        prosumer={action?.mode === 'deactivate' ? action.prosumer : null}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmDeactivate}
        onCancel={handleCancelAction}
      />

      <ProsumerPasswordDialog
        prosumer={action?.mode === 'password' ? action.prosumer : null}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmResetPassword}
        onCancel={handleCancelAction}
      />
    </div>
  );
}

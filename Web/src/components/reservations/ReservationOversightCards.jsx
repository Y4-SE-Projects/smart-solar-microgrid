// File: ReservationOversightCards.jsx
// Purpose: Display live operator reservation totals in the four-card oversight layout.

import { useMemo } from 'react';

const OVERSIGHT_CARDS = [
    {
        key: 'active',
        label: 'ACTIVE RESERVATIONS',
        icon: 'bolt',
        iconClasses: 'bg-mint-surface text-primary',
        statusClasses: 'border-secondary/20 bg-mint-surface text-primary',
        leftNote: 'Future booked trades',
    },
    {
        key: 'approved',
        label: 'APPROVED RESERVATIONS',
        icon: 'verified',
        iconClasses: 'bg-operational-blue/10 text-operational-blue',
        statusClasses: 'border-operational-blue/20 bg-operational-blue/10 text-operational-blue',
        leftNote: 'Future approved bookings',
    },
    {
        key: 'pending',
        label: 'PENDING APPROVAL',
        icon: 'pending_actions',
        iconClasses: 'bg-error-container text-alert-danger',
        statusClasses: 'border-alert-danger/20 bg-error-container text-alert-danger',
        leftNote: 'Awaiting Grid verification',
    },
    {
        key: 'completed',
        label: 'COMPLETED TRANSFERS',
        icon: 'task_alt',
        iconClasses: 'bg-surface-container-high text-operational-blue',
        statusClasses: 'border-secondary/20 bg-mint-surface text-primary',
        leftNote: 'Completed reservations',
    },
];

const formatCount = (count) => count.toLocaleString('en-US');
const formatShare = (count, total) => `${total === 0 ? 0 : Math.round((count / total) * 100)}%`;

export default function ReservationOversightCards({ counts, isLoading, error }) {
    const metrics = useMemo(() => {
        if (!counts) return null;

        const active = counts.futurePending + counts.futureApproved;

        return {
            active: {
                value: formatCount(active),
                status: `${formatShare(active, counts.total)} of total`,
                rightNote: `${formatCount(counts.futurePending)} pending / ${formatCount(counts.futureApproved)} approved`,
            },
            approved: {
                value: formatCount(counts.approved),
                status: `${formatShare(counts.approved, counts.total)} of total`,
                rightNote: `${formatCount(counts.futureApproved)} future`,
            },
            pending: {
                value: formatCount(counts.pending),
                status: counts.pending > 0 ? 'Action Required' : 'Queue clear',
                rightNote: `${formatShare(counts.pending, counts.total)} of total`,
            },
            completed: {
                value: formatCount(counts.completed),
                status: `${formatShare(counts.completed, counts.total)} of total`,
                rightNote: `${formatCount(counts.completed)} of ${formatCount(counts.total)} total`,
            },
        };
    }, [counts]);

    return (
        <section aria-label="Reservation oversight summary" aria-busy={isLoading} className="mb-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {OVERSIGHT_CARDS.map((card) => {
                    const metric = metrics?.[card.key];
                    return (
                        <article
                            key={card.key}
                            className="flex min-w-0 flex-col rounded-2xl border border-border-slate bg-surface-container-lowest p-4 shadow-sm xl:p-5"
                        >
                            <div className="flex min-w-0 items-start justify-between gap-2">
                                <h2 className="min-w-0 pt-1 text-label-sm font-semibold uppercase tracking-wider text-outline">
                                    {card.label}
                                </h2>
                                <span aria-hidden="true" className={`flex size-9 shrink-0 items-center justify-center rounded-full ${card.iconClasses}`}>
                                    <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                                </span>
                            </div>

                            <div className="mb-4 mt-4 flex flex-wrap items-end justify-between gap-x-2 gap-y-2">
                                {isLoading ? (
                                    <>
                                        <span aria-hidden="true" className="h-8 w-16 animate-pulse rounded-md bg-surface-container-high motion-reduce:animate-none" />
                                        <span aria-hidden="true" className="h-6 w-20 animate-pulse rounded-md bg-surface-container-high motion-reduce:animate-none" />
                                    </>
                                ) : (
                                    <>
                                        <span className="text-metric-num font-bold tabular-nums tracking-tight text-on-surface">
                                            {metric?.value ?? '—'}
                                        </span>
                                        <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold leading-4 ${metric ? card.statusClasses : 'border-border-slate bg-canvas-bg text-on-surface-variant'}`}>
                                            {metric?.status ?? 'Unavailable'}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border-slate pt-3 text-body-sm leading-relaxed text-on-surface-variant">
                                <span>{card.leftNote}</span>
                                <span className="text-right font-medium">
                                    {isLoading ? (
                                        <span aria-hidden="true" className="inline-block h-4 w-16 animate-pulse rounded bg-surface-container-high motion-reduce:animate-none" />
                                    ) : (metric?.rightNote ?? '—')}
                                </span>
                            </div>
                        </article>
                    );
                })}
            </div>
            {isLoading && <span className="sr-only">Loading reservation summary</span>}
            {error && <p role="status" className="mt-2 text-body-sm text-alert-danger">{error}</p>}
        </section>
    );
}

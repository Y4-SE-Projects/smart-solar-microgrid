// File: ReservationPolicyBanner.jsx
// Purpose: Display the API-enforced reservation notice policy.

export default function ReservationPolicyBanner() {
    return (
        <section
            aria-labelledby="reservation-policy-title"
            className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 rounded-2xl border border-border-slate bg-surface-container-lowest p-5 shadow-sm"
        >
            <div className="flex min-w-0 items-start gap-4">
                <div
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint-surface text-primary-container"
                >
                    <span className="material-symbols-outlined text-[24px]">
                        verified_user
                    </span>
                </div>

                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h2
                            id="reservation-policy-title"
                            className="text-body-md font-bold text-on-surface"
                        >
                            12-Hour Modification &amp; Cancellation Rule Enforced
                        </h2>
                        <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-label-sm font-semibold uppercase tracking-wide text-on-primary">
                            Active Enforcement
                        </span>
                    </div>

                    <p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">
                        Reservation updates and cancellations require at least{' '}
                        <strong className="font-semibold text-on-surface">
                            12 hours&apos; notice
                        </strong>{' '}
                        before the scheduled reservation time.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start xl:shrink-0 xl:self-center">
                <span className="text-body-sm font-medium text-on-surface-variant">
                    Automated Policy:
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-surface px-3 py-1 text-body-sm font-semibold text-primary">
                    <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full bg-secondary"
                    />
                    Enforced on API Core
                </span>
            </div>
        </section>
    );
}
// File: ReservationPolicyBanner.jsx
// Purpose: Display the API-enforced reservation notice policy.

export default function ReservationPolicyBanner() {
    return (
        <section
            aria-labelledby="reservation-policy-title"
            className="rounded-2xl border border-border-slate bg-surface-container-lowest p-5 shadow-sm"
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
                    <h2 id="reservation-policy-title" className="text-body-md font-bold text-on-surface">
                        Changes and cancellations
                    </h2>

                    <p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">
                        Update or cancel a reservation at least{' '}
                        <strong className="font-semibold text-on-surface">
                            12 hours&apos; notice
                        </strong>{' '}
                        before its scheduled time.
                    </p>
                </div>
            </div>

        </section>
    );
}

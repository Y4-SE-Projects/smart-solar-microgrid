// File: ReservationTimeIndicator.jsx
// Purpose: Display an approximate time to execution; the API decides eligibility.

export default function ReservationTimeIndicator({ scheduledTime, status, now }) {
    if (status === 'Completed') {
        return <span className="text-xs font-medium text-outline">Executed</span>;
    }

    if (status === 'Cancelled' || status === 'Declined') {
        return <span className="text-xs font-medium text-outline">{status}</span>;
    }

    const scheduled = new Date(scheduledTime).getTime();
    if (!scheduledTime || Number.isNaN(scheduled)) {
        return <span className="text-xs text-outline">—</span>;
    }

    if (now === null) {
        return <span className="text-xs text-outline">—</span>;
    }

    const remaining = scheduled - now;
    if (remaining <= 0) {
        return <span className="text-xs font-medium text-outline">Elapsed</span>;
    }

    const minutes = Math.ceil(remaining / 60000);
    const hours = Math.floor(minutes / 60);
    const minutePart = minutes % 60;
    const timeText = hours > 0 ? `${hours}h ${minutePart}m` : `${minutes}m`;
    const withinTwelveHours = remaining < 12 * 60 * 60 * 1000;

    return (
        <span
            title="Display estimate only; the API decides whether changes are allowed."
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${withinTwelveHours
                    ? 'bg-error-container text-alert-danger'
                    : 'bg-surface-container-high text-primary'
                }`}
        >
            <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
                {withinTwelveHours ? 'schedule' : 'schedule'}
            </span>
            {timeText}
            <span className="font-medium">
                {withinTwelveHours ? 'Within 12h' : 'until start'}
            </span>
        </span>
    );
}
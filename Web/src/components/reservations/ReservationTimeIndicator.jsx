// File: ReservationTimeIndicator.jsx
// Purpose: Display an approximate time to execution; the API decides eligibility.

export default function ReservationTimeIndicator({ scheduledTime, status, now }) {
    if (status === 'Completed' || status === 'Cancelled' || status === 'Declined') {
        return <span className="text-xs text-outline">—</span>;
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
        return <span className="text-xs text-outline">—</span>;
    }

    const minutes = Math.ceil(remaining / 60000);
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const minutePart = minutes % 60;
    const timeText = days > 0
        ? `${days}d ${hours}h ${minutePart}min`
        : hours > 0 ? `${hours}h ${minutePart}min` : `${minutes}min`;
    const withinTwelveHours = remaining < 12 * 60 * 60 * 1000;

    return (
        <span
            className={`whitespace-nowrap font-medium tabular-nums ${withinTwelveHours
                    ? 'text-alert-danger'
                    : 'text-on-surface-variant'
                }`}
        >
            {timeText}
        </span>
    );
}

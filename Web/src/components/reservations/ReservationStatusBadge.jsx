// File: ReservationStatusBadge.jsx
// Purpose: Reusable semantic reservation status chip.

const STATUS_STYLES = {
    Pending: {
        icon: "hourglass_top",
        classes:
            "border-operational-blue/20 bg-surface-container text-operational-blue",
    },
    Approved: {
        icon: "verified",
        classes: "border-secondary/20 bg-mint-surface text-primary",
    },
    Completed: {
        icon: "done_all",
        classes: "border-secondary/20 bg-secondary-container/40 text-secondary",
    },
    Cancelled: {
        icon: "block",
        classes: "border-alert-danger/20 bg-error-container text-alert-danger",
    },
    Declined: {
        icon: "cancel",
        classes: "border-alert-danger/20 bg-error-container text-alert-danger",
    },
};

export default function ReservationStatusBadge({ status }) {
    if (!status) return <span className="text-xs text-outline">—</span>;

    const style = STATUS_STYLES[status] || {
        icon: "label",
        classes: "border-border-slate bg-surface-container-high text-on-surface",
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${style.classes}`}
        >
            <span
                aria-hidden="true"
                className="material-symbols-outlined text-[15px]"
            >
                {style.icon}
            </span>
            {status}
        </span>
    );
}

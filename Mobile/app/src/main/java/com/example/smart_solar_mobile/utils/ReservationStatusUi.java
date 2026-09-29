// File: ReservationStatusUi.java
// Purpose: Maps a reservation status string to the app's chip colors and label, shared by the
// reservation history list and the reservation detail screen.

package com.example.smart_solar_mobile.utils;

import com.example.smart_solar_mobile.R;

public final class ReservationStatusUi {

    private ReservationStatusUi() {
        // Static helper only, never instantiated
    }

    public static int chipBackground(String status) {
        if (isApprovedOrCompleted(status)) return R.drawable.bg_chip_active;
        if (isDeclinedCancelledOrExpired(status)) return R.drawable.bg_chip_danger;
        return R.drawable.bg_chip_warning;
    }

    public static int chipTextColor(String status) {
        if (isApprovedOrCompleted(status)) return R.color.primary_container;
        if (isDeclinedCancelledOrExpired(status)) return R.color.alert_danger;
        return R.color.alert_warning;
    }

    public static int chipLabel(String status) {
        if ("Approved".equalsIgnoreCase(status)) return R.string.reservation_status_approved;
        if ("Completed".equalsIgnoreCase(status)) return R.string.reservation_status_completed;
        if ("Declined".equalsIgnoreCase(status)) return R.string.reservation_status_declined;
        if ("Cancelled".equalsIgnoreCase(status)) return R.string.reservation_status_cancelled;
        if ("Expired".equalsIgnoreCase(status)) return R.string.reservation_status_expired;
        return R.string.reservation_status_pending;
    }

    private static boolean isApprovedOrCompleted(String status) {
        return "Approved".equalsIgnoreCase(status) || "Completed".equalsIgnoreCase(status);
    }

    private static boolean isDeclinedCancelledOrExpired(String status) {
        return "Declined".equalsIgnoreCase(status) || "Cancelled".equalsIgnoreCase(status)
                || "Expired".equalsIgnoreCase(status);
    }
}

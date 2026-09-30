// File: ProsumerHomeActivity.java
// Purpose: Prosumer dashboard: welcome banner, account card, the live pending and approved-future counts,
//          upcoming bookings and an activity summary, all read from the API.
// Author: IT23215856 (original home screen), IT23218512 (dashboard)

package com.example.smart_solar_mobile.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionEntity;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.DashboardCounts;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.models.SolarStation;
import com.example.smart_solar_mobile.models.UserProfile;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.NameUtils;
import com.example.smart_solar_mobile.utils.ReservationStatusUi;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.example.smart_solar_mobile.views.ProsumerBottomNavigation;
import com.google.android.material.button.MaterialButton;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProsumerHomeActivity extends AppCompatActivity {
    // How many upcoming bookings the dashboard lists; "See all" opens the full history
    private static final int MAX_UPCOMING = 3;
    private static final String STATUS_PENDING = "Pending";
    private static final String STATUS_APPROVED = "Approved";
    private static final String STATUS_COMPLETED = "Completed";
    private static final String STATUS_CANCELLED = "Cancelled";
    private static final String STATUS_DECLINED = "Declined";

    private TextView greetingText;
    private View nextTransferRow;
    private TextView nextTransferText;
    private TextView nextStationText;
    private TextView accountStatusChip;
    private TextView memberSinceText;
    private TextView pendingCountText;
    private TextView approvedCountText;
    private TextView countsErrorText;
    private View countsErrorBanner;
    private View bookingsLoadingText;
    private View bookingsErrorBanner;
    private TextView bookingsErrorText;
    private View bookingsEmptyCard;
    private LinearLayout upcomingList;
    private View activityCard;
    private TextView completedCountText;
    private TextView cancelledCountText;
    private TextView declinedCountText;

    // NIC from the saved session; every endpoint used here only answers for the signed-in Prosumer's own NIC
    private String prosumerNic;
    private boolean countsLoaded;
    // Null until the booking history has loaded once
    private List<ReservationData> reservations;
    // Station ID -> name, so booking cards can show "Colombo North Hub" rather than only "STN-001"
    private final Map<String, String> stationNames = new HashMap<>();

    private Call<DashboardCounts> countsCall;
    private Call<ApiResponse<UserProfile>> profileCall;
    private Call<ApiResponse<List<ReservationData>>> bookingsCall;
    private Call<ApiResponse<List<SolarStation>>> stationsCall;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds the dashboard, wires the booking entry points and loads the signed-in Prosumer
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_prosumer_home);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.homeRoot));
        ((ProsumerBottomNavigation) findViewById(R.id.prosumerBottomNavigation))
                .setup(this, ProsumerBottomNavigation.Destination.HOME);
        bindViews();

        // Clips the faint sun to the banner's rounded corners (the XML attribute needs API 31)
        findViewById(R.id.welcomeBanner).setClipToOutline(true);

        findViewById(R.id.signOutButton).setOnClickListener(v ->
                SessionManager.getInstance().endSession(() -> Navigator.openLogin(this, false)));
        findViewById(R.id.countsRetryButton).setOnClickListener(v -> loadCounts());
        findViewById(R.id.bookingsRetryButton).setOnClickListener(v -> loadBookings());
        // Direct booking works without location permission or a nearby-map result
        findViewById(R.id.directReservationButton).setOnClickListener(v ->
                startActivity(new Intent(this, CreateReservationActivity.class)));
        // Keeps the Member 02 nearby-map path and its preselected-station handoff
        findViewById(R.id.createReservationButton).setOnClickListener(v ->
                startActivity(new Intent(this, StationMapActivity.class)));
        findViewById(R.id.viewReservationsButton).setOnClickListener(v -> openHistory());
        findViewById(R.id.seeAllBookingsButton).setOnClickListener(v -> openHistory());

        // Loads the session here too, because Android can reopen the app straight onto this screen
        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || session.identifier == null || session.identifier.trim().isEmpty()) {
                Navigator.openLogin(this, false);
                return;
            }
            renderIdentity(session);

            prosumerNic = session.identifier;
            loadProfile();
            loadStations();
            loadCounts();
            loadBookings();
        });
    }

    @Override
    protected void onResume() {
        // Refreshes the greeting, name, counts and bookings on return, so they are right after booking,
        // cancelling or editing the profile
        super.onResume();
        greetingText.setText(greetingForNow());
        if (prosumerNic != null) {
            SessionManager.getInstance().loadSession(session -> {
                if (session != null && !isFinishing() && !isDestroyed()) {
                    renderIdentity(session);
                }
            });
            loadCounts();
            loadBookings();
        }
    }

    private void renderIdentity(SessionEntity session) {
        // Shows the signed-in Prosumer's name, initials and NIC from the saved session
        String name = session.fullName == null || session.fullName.trim().isEmpty()
                ? session.identifier : session.fullName.trim();
        ((TextView) findViewById(R.id.bannerNameText)).setText(name);
        ((TextView) findViewById(R.id.avatarText)).setText(NameUtils.initialsOf(name));
        ((TextView) findViewById(R.id.nameText)).setText(name);
        ((TextView) findViewById(R.id.nicText)).setText(getString(R.string.home_nic, session.identifier));
    }

    @Override
    protected void onDestroy() {
        // Drops in-flight requests so their replies can't touch a closed screen
        cancel(countsCall);
        cancel(profileCall);
        cancel(bookingsCall);
        cancel(stationsCall);
        super.onDestroy();
    }

    private void bindViews() {
        // Looks up every view the dashboard updates after loading
        greetingText = findViewById(R.id.greetingText);
        nextTransferRow = findViewById(R.id.nextTransferRow);
        nextTransferText = findViewById(R.id.nextTransferText);
        nextStationText = findViewById(R.id.nextStationText);
        accountStatusChip = findViewById(R.id.accountStatusChip);
        memberSinceText = findViewById(R.id.memberSinceText);
        pendingCountText = findViewById(R.id.pendingCountText);
        approvedCountText = findViewById(R.id.approvedCountText);
        countsErrorText = findViewById(R.id.countsErrorText);
        countsErrorBanner = findViewById(R.id.countsErrorBanner);
        bookingsLoadingText = findViewById(R.id.bookingsLoadingText);
        bookingsErrorBanner = findViewById(R.id.bookingsErrorBanner);
        bookingsErrorText = findViewById(R.id.bookingsErrorText);
        bookingsEmptyCard = findViewById(R.id.bookingsEmptyCard);
        upcomingList = findViewById(R.id.upcomingList);
        activityCard = findViewById(R.id.activityCard);
        completedCountText = findViewById(R.id.completedCountText);
        cancelledCountText = findViewById(R.id.cancelledCountText);
        declinedCountText = findViewById(R.id.declinedCountText);
    }

    private void openHistory() {
        // Opens the full booking history owned by the reservation screens
        startActivity(new Intent(this, ReservationHistoryActivity.class));
    }

    // ---------------------------------------------------------------- Counts

    private void loadCounts() {
        // Asks the API for the two dashboard counts; only the latest request is allowed to update the screen
        if (prosumerNic == null) {
            return;
        }
        cancel(countsCall);
        countsErrorBanner.setVisibility(View.GONE);
        // Dashes only before the first load; a refresh keeps the last numbers until new ones arrive
        if (!countsLoaded) {
            pendingCountText.setText(R.string.metric_empty);
            approvedCountText.setText(R.string.metric_empty);
        }

        countsCall = NetworkManager.getInstance().getApiService().getDashboardCounts(prosumerNic);
        final Call<DashboardCounts> call = countsCall;
        call.enqueue(new Callback<DashboardCounts>() {
            @Override
            public void onResponse(@NonNull Call<DashboardCounts> request,
                                   @NonNull Response<DashboardCounts> response) {
                // This endpoint replies without the usual envelope, so success is judged by the HTTP status
                if (isStale(call, countsCall)) {
                    return;
                }
                DashboardCounts body = response.body();
                if (response.isSuccessful() && body != null) {
                    pendingCountText.setText(formatCount(body.pendingCount));
                    approvedCountText.setText(formatCount(body.approvedFutureCount));
                    countsLoaded = true;
                } else {
                    showCountsError(ApiErrorParser.getMessage(ProsumerHomeActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<DashboardCounts> request, @NonNull Throwable t) {
                // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                if (isStale(call, countsCall)) {
                    return;
                }
                showCountsError(getString(R.string.error_network));
            }
        });
    }

    private void showCountsError(String message) {
        // Shows why the counts failed, with Retry beside the message
        countsErrorText.setText(message);
        countsErrorBanner.setVisibility(View.VISIBLE);
    }

    // ---------------------------------------------------------------- Account card

    private void loadProfile() {
        // Reads the account status and creation date; the card still works from the session if this fails
        cancel(profileCall);
        profileCall = NetworkManager.getInstance().getApiService().getProfile(prosumerNic);
        final Call<ApiResponse<UserProfile>> call = profileCall;
        call.enqueue(new Callback<ApiResponse<UserProfile>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<UserProfile>> request,
                                   @NonNull Response<ApiResponse<UserProfile>> response) {
                // Shows the "Active Prosumer" chip and the member-since month from the live profile
                if (isStale(call, profileCall)) {
                    return;
                }
                ApiResponse<UserProfile> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null) {
                    return;
                }
                accountStatusChip.setVisibility(UserProfile.STATUS_ACTIVE.equals(body.data.status)
                        ? View.VISIBLE : View.GONE);
                Date createdAt = TimeUtils.parseApiDate(body.data.createdAt);
                if (createdAt != null) {
                    memberSinceText.setText(TimeUtils.formatMonthYear(createdAt));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<UserProfile>> request, @NonNull Throwable t) {
                // Leaves the chip hidden and member-since as a dash; the counts banner already reports connection problems
            }
        });
    }

    // ---------------------------------------------------------------- Stations

    private void loadStations() {
        // Loads station names once so booking cards can show them; on failure the cards fall back to station IDs
        cancel(stationsCall);
        stationsCall = NetworkManager.getInstance().getApiService().getStations();
        final Call<ApiResponse<List<SolarStation>>> call = stationsCall;
        call.enqueue(new Callback<ApiResponse<List<SolarStation>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<SolarStation>>> request,
                                   @NonNull Response<ApiResponse<List<SolarStation>>> response) {
                // Fills the ID -> name lookup and redraws any bookings already on screen
                if (isStale(call, stationsCall)) {
                    return;
                }
                ApiResponse<List<SolarStation>> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null) {
                    return;
                }
                for (SolarStation station : body.data) {
                    if (station.stationId != null && station.name != null) {
                        stationNames.put(station.stationId, station.name);
                    }
                }
                if (reservations != null) {
                    renderBookings();
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<SolarStation>>> request, @NonNull Throwable t) {
                // Station IDs are shown instead of names
            }
        });
    }

    // ---------------------------------------------------------------- Bookings

    private void loadBookings() {
        // Loads the Prosumer's booking history, which feeds the banner, the upcoming list and the activity totals
        if (prosumerNic == null) {
            return;
        }
        cancel(bookingsCall);
        bookingsErrorBanner.setVisibility(View.GONE);
        bookingsLoadingText.setVisibility(reservations == null ? View.VISIBLE : View.GONE);

        bookingsCall = NetworkManager.getInstance().getApiService().getProsumerReservations(prosumerNic);
        final Call<ApiResponse<List<ReservationData>>> call = bookingsCall;
        call.enqueue(new Callback<ApiResponse<List<ReservationData>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                   @NonNull Response<ApiResponse<List<ReservationData>>> response) {
                // Redraws everything that depends on the bookings, or reports why they failed
                if (isStale(call, bookingsCall)) {
                    return;
                }
                bookingsLoadingText.setVisibility(View.GONE);
                ApiResponse<List<ReservationData>> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    reservations = body.data;
                    renderBookings();
                    renderActivity();
                } else {
                    showBookingsError(ApiErrorParser.getMessage(ProsumerHomeActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<ReservationData>>> request, @NonNull Throwable t) {
                // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                if (isStale(call, bookingsCall)) {
                    return;
                }
                bookingsLoadingText.setVisibility(View.GONE);
                showBookingsError(getString(R.string.error_network));
            }
        });
    }

    private void showBookingsError(String message) {
        // Shows why the bookings failed, with Retry beside the message
        bookingsErrorText.setText(getString(R.string.action_error, getString(R.string.history_error_title), message));
        bookingsErrorBanner.setVisibility(View.VISIBLE);
    }

    private void renderBookings() {
        // Lists the soonest Pending/Approved bookings that haven't started yet, and fills the banner's next-transfer line
        List<ReservationData> upcoming = new ArrayList<>();
        Map<ReservationData, Date> times = new HashMap<>();
        Date now = new Date();
        for (ReservationData reservation : reservations) {
            Date scheduled = TimeUtils.parseApiDate(reservation.scheduledTime);
            boolean active = STATUS_PENDING.equalsIgnoreCase(reservation.status)
                    || STATUS_APPROVED.equalsIgnoreCase(reservation.status);
            if (active && scheduled != null && !scheduled.before(now)) {
                upcoming.add(reservation);
                times.put(reservation, scheduled);
            }
        }
        Collections.sort(upcoming, (a, b) -> times.get(a).compareTo(times.get(b)));

        upcomingList.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(this);
        for (int i = 0; i < Math.min(MAX_UPCOMING, upcoming.size()); i++) {
            ReservationData reservation = upcoming.get(i);
            View card = inflater.inflate(R.layout.item_dashboard_booking, upcomingList, false);
            bindBookingCard(card, reservation, times.get(reservation));
            upcomingList.addView(card);
        }
        bookingsEmptyCard.setVisibility(upcoming.isEmpty() ? View.VISIBLE : View.GONE);

        renderNextTransfer(upcoming, times);
    }

    private void bindBookingCard(View card, ReservationData reservation, Date scheduled) {
        // Fills one upcoming-booking card; its button opens the existing detail screen (QR pass once Approved)
        TextView statusChip = card.findViewById(R.id.bookingStatusChip);
        statusChip.setBackgroundResource(ReservationStatusUi.chipBackground(reservation.status));
        statusChip.setTextColor(ContextCompat.getColor(this, ReservationStatusUi.chipTextColor(reservation.status)));
        statusChip.setText(ReservationStatusUi.chipLabel(reservation.status));

        ((TextView) card.findViewById(R.id.bookingDayText)).setText(dayLabel(scheduled));
        ((TextView) card.findViewById(R.id.bookingStationText)).setText(stationNameOf(reservation.stationId));
        ((TextView) card.findViewById(R.id.bookingMetaText)).setText(getString(R.string.history_item_meta,
                reservation.stationId, TimeUtils.formatTime(scheduled)));
        ((TextView) card.findViewById(R.id.bookingSlotText)).setText(reservation.slotId);
        ((TextView) card.findViewById(R.id.bookingReferenceText)).setText(reservation.reservationId);

        MaterialButton action = card.findViewById(R.id.bookingActionButton);
        boolean approved = STATUS_APPROVED.equalsIgnoreCase(reservation.status);
        action.setText(approved ? R.string.dashboard_view_qr : R.string.dashboard_view_details);
        action.setIconResource(approved ? R.drawable.ic_qr_code : R.drawable.ic_arrow_forward);
        action.setOnClickListener(v -> ReservationDetailActivity.start(this, reservation));
    }

    private void renderNextTransfer(List<ReservationData> upcoming, Map<ReservationData, Date> times) {
        // Banner line: the soonest Approved booking, else the soonest Pending one, else a prompt to book
        ReservationData next = null;
        for (ReservationData reservation : upcoming) {
            if (STATUS_APPROVED.equalsIgnoreCase(reservation.status)) {
                next = reservation;
                break;
            }
        }
        boolean approved = next != null;
        if (next == null && !upcoming.isEmpty()) {
            next = upcoming.get(0);
        }

        if (next == null) {
            nextTransferText.setText(R.string.dashboard_no_upcoming);
            nextStationText.setVisibility(View.GONE);
        } else {
            Date scheduled = times.get(next);
            String when = getString(R.string.history_item_meta, dayLabel(scheduled), TimeUtils.formatTime(scheduled));
            nextTransferText.setText(getString(approved
                    ? R.string.dashboard_next_transfer : R.string.dashboard_next_pending, when));
            nextStationText.setText(stationNameOf(next.stationId));
            nextStationText.setVisibility(View.VISIBLE);
        }
        nextTransferRow.setVisibility(View.VISIBLE);
    }

    private void renderActivity() {
        // Totals of finished bookings from the history: completed transfers, cancellations and declines
        int completed = 0;
        int cancelled = 0;
        int declined = 0;
        for (ReservationData reservation : reservations) {
            if (STATUS_COMPLETED.equalsIgnoreCase(reservation.status)) {
                completed++;
            } else if (STATUS_CANCELLED.equalsIgnoreCase(reservation.status)) {
                cancelled++;
            } else if (STATUS_DECLINED.equalsIgnoreCase(reservation.status)) {
                declined++;
            }
        }
        completedCountText.setText(formatCount(completed));
        cancelledCountText.setText(formatCount(cancelled));
        declinedCountText.setText(formatCount(declined));
        activityCard.setVisibility(View.VISIBLE);
    }

    // ---------------------------------------------------------------- Helpers

    private String stationNameOf(String stationId) {
        // The station's name when known, otherwise its ID
        String name = stationNames.get(stationId);
        return name == null || name.trim().isEmpty() ? stationId : name;
    }

    private String dayLabel(Date date) {
        // "Today", "Tomorrow", or a short date such as "Sat, 3 Oct"
        Date now = new Date();
        if (TimeUtils.isSameLocalDay(date, now)) {
            return getString(R.string.today);
        }
        Calendar tomorrow = Calendar.getInstance();
        tomorrow.add(Calendar.DAY_OF_MONTH, 1);
        if (TimeUtils.isSameLocalDay(date, tomorrow.getTime())) {
            return getString(R.string.dashboard_tomorrow);
        }
        return TimeUtils.formatShortDate(date);
    }

    private String greetingForNow() {
        // Morning before noon, afternoon until 5 pm, evening after that
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (hour < 12) {
            return getString(R.string.dashboard_greeting_morning);
        }
        return getString(hour < 17 ? R.string.dashboard_greeting_afternoon : R.string.dashboard_greeting_evening);
    }

    private static String formatCount(long count) {
        // A count in the phone's number format
        return String.format(Locale.getDefault(), "%d", count);
    }

    private boolean isStale(Call<?> call, Call<?> latest) {
        // True when the screen is closing or a newer request has replaced this one
        return isFinishing() || isDestroyed() || call != latest || call.isCanceled();
    }

    private static void cancel(Call<?> call) {
        // Cancels a request if one is running
        if (call != null) {
            call.cancel();
        }
    }
}

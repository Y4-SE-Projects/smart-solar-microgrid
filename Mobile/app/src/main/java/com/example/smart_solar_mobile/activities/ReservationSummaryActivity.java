// File: ReservationSummaryActivity.java
// Purpose: Shows the API-confirmed result of a Prosumer reservation create, update, or cancellation.

package com.example.smart_solar_mobile.activities;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.ReservationStatusUi;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.snackbar.Snackbar;

import java.util.Date;

public class ReservationSummaryActivity extends AppCompatActivity {
    public enum Action {
        CREATE, UPDATE, CANCEL
    }

    private static final String EXTRA_ACTION = "reservation_summary.action";
    private static final String EXTRA_RESERVATION_ID = "reservation_summary.reservation_id";
    private static final String EXTRA_PROSUMER_NIC = "reservation_summary.prosumer_nic";
    private static final String EXTRA_STATION_ID = "reservation_summary.station_id";
    private static final String EXTRA_SLOT_ID = "reservation_summary.slot_id";
    private static final String EXTRA_SCHEDULED_TIME = "reservation_summary.scheduled_time";
    private static final String EXTRA_STATUS = "reservation_summary.status";
    private static final String EXTRA_CREATED_AT = "reservation_summary.created_at";
    private static final String EXTRA_UPDATED_AT = "reservation_summary.updated_at";

    private Action action;
    private ReservationData reservation;

    public static void open(@NonNull Context context, @NonNull Action action,
                            @Nullable ReservationData reservation) {
        // Copies only the confirmed API fields needed for this result screen.
        Intent intent = new Intent(context, ReservationSummaryActivity.class);
        intent.putExtras(extrasFor(action, reservation));
        if (!(context instanceof Activity)) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }
        context.startActivity(intent);
    }

    private static Bundle extrasFor(@Nullable Action action,
                                    @Nullable ReservationData reservation) {
        // One string-only contract is shared by launch and Activity recreation.
        Bundle extras = new Bundle();
        if (action != null) extras.putString(EXTRA_ACTION, action.name());
        if (reservation != null) {
            extras.putString(EXTRA_RESERVATION_ID, reservation.reservationId);
            extras.putString(EXTRA_PROSUMER_NIC, reservation.prosumerNic);
            extras.putString(EXTRA_STATION_ID, reservation.stationId);
            extras.putString(EXTRA_SLOT_ID, reservation.slotId);
            extras.putString(EXTRA_SCHEDULED_TIME, reservation.scheduledTime);
            extras.putString(EXTRA_STATUS, reservation.status);
            extras.putString(EXTRA_CREATED_AT, reservation.createdAt);
            extras.putString(EXTRA_UPDATED_AT, reservation.updatedAt);
        }
        return extras;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Restores confirmed fields without another API call or mutation.
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reservation_summary);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.summaryRoot));

        Bundle source = savedInstanceState != null && savedInstanceState.containsKey(EXTRA_ACTION)
                ? savedInstanceState : getIntent().getExtras();
        readConfirmedData(source);
        render();

        findViewById(R.id.summaryBackButton).setOnClickListener(v -> returnHome());
        findViewById(R.id.summaryDoneButton).setOnClickListener(v -> returnHome());
        findViewById(R.id.summaryCopyButton).setOnClickListener(v -> copyReservationId());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                returnHome();
            }
        });
    }

    private void readConfirmedData(@Nullable Bundle source) {
        // Missing or unknown actions lead to the honest unavailable state.
        reservation = new ReservationData();
        if (source == null) return;
        String actionName = source.getString(EXTRA_ACTION);
        if (actionName != null) {
            try {
                action = Action.valueOf(actionName);
            } catch (IllegalArgumentException ignored) {
                action = null;
            }
        }
        reservation.reservationId = source.getString(EXTRA_RESERVATION_ID);
        reservation.prosumerNic = source.getString(EXTRA_PROSUMER_NIC);
        reservation.stationId = source.getString(EXTRA_STATION_ID);
        reservation.slotId = source.getString(EXTRA_SLOT_ID);
        reservation.scheduledTime = source.getString(EXTRA_SCHEDULED_TIME);
        reservation.status = source.getString(EXTRA_STATUS);
        reservation.createdAt = source.getString(EXTRA_CREATED_AT);
        reservation.updatedAt = source.getString(EXTRA_UPDATED_AT);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Retains the same server-confirmed values through rotation and process recreation.
        super.onSaveInstanceState(outState);
        outState.putAll(extrasFor(action, reservation));
    }

    private void render() {
        // Separates the successful action message from the server's current reservation status.
        if (action == null || !hasText(reservation.reservationId)) {
            renderUnavailable();
            return;
        }

        int title;
        int message;
        switch (action) {
            case CREATE:
                title = R.string.summary_created_title;
                message = R.string.summary_created_message;
                break;
            case UPDATE:
                title = R.string.summary_updated_title;
                message = R.string.summary_updated_message;
                break;
            case CANCEL:
                title = R.string.summary_cancelled_title;
                message = R.string.summary_cancelled_message;
                break;
            default:
                renderUnavailable();
                return;
        }

        ((TextView) findViewById(R.id.summaryActionTitleText)).setText(title);
        ((TextView) findViewById(R.id.summaryActionMessageText)).setText(message);
        ((TextView) findViewById(R.id.summaryReferenceText)).setText(reservation.reservationId);
        renderStatus();
        renderSchedule();
        renderDetails();
    }

    private void renderUnavailable() {
        // Never fills an incomplete handoff with guessed reservation details.
        ((TextView) findViewById(R.id.summaryEyebrowText))
                .setText(R.string.summary_unavailable_eyebrow);
        ((TextView) findViewById(R.id.summaryActionTitleText))
                .setText(R.string.summary_unavailable_title);
        ((TextView) findViewById(R.id.summaryActionMessageText))
                .setText(R.string.summary_unavailable_message);
        ImageView icon = findViewById(R.id.summaryHeroIcon);
        icon.setImageResource(R.drawable.ic_error);
        icon.setBackgroundResource(R.drawable.bg_avatar);
        icon.setImageTintList(ColorStateList.valueOf(getColor(R.color.on_surface_variant)));
        findViewById(R.id.summaryStatusChip).setVisibility(View.GONE);
        findViewById(R.id.summaryReferenceCard).setVisibility(View.GONE);
        findViewById(R.id.summaryScheduleCard).setVisibility(View.GONE);
        findViewById(R.id.summaryDetailsCard).setVisibility(View.GONE);
    }

    private void renderStatus() {
        // Reuses the shared status treatment when the API returns a recognized status.
        TextView chip = findViewById(R.id.summaryStatusChip);
        String status = reservation.status;
        if (!hasText(status)) {
            chip.setVisibility(View.GONE);
            return;
        }
        if (isKnownStatus(status)) {
            chip.setText(ReservationStatusUi.chipLabel(status));
            if (action == Action.CANCEL && "Cancelled".equalsIgnoreCase(status)) {
                // Cancellation is a confirmed action, so its result chip stays neutral here.
                chip.setBackgroundResource(R.drawable.bg_chip_neutral);
                chip.setTextColor(getColor(R.color.on_surface_variant));
            } else {
                chip.setBackgroundResource(ReservationStatusUi.chipBackground(status));
                chip.setTextColor(getColor(ReservationStatusUi.chipTextColor(status)));
            }
        } else {
            chip.setText(status);
            chip.setBackgroundResource(R.drawable.bg_chip_neutral);
            chip.setTextColor(getColor(R.color.on_surface_variant));
        }
        chip.setVisibility(View.VISIBLE);
    }

    private static boolean isKnownStatus(String status) {
        // Guards the shared helper's Pending default so an unknown API value is not relabelled.
        return "Pending".equalsIgnoreCase(status)
                || "Approved".equalsIgnoreCase(status)
                || "Completed".equalsIgnoreCase(status)
                || "Cancelled".equalsIgnoreCase(status)
                || "Declined".equalsIgnoreCase(status);
    }

    private void renderSchedule() {
        // Presents local time when parseable and the untouched API value otherwise.
        View card = findViewById(R.id.summaryScheduleCard);
        if (!hasText(reservation.scheduledTime)) {
            card.setVisibility(View.GONE);
            return;
        }
        Date scheduled = TimeUtils.parseApiDate(reservation.scheduledTime);
        TextView dateText = findViewById(R.id.summaryScheduleDateText);
        TextView timeText = findViewById(R.id.summaryScheduleTimeText);
        if (scheduled == null) {
            dateText.setText(reservation.scheduledTime);
            timeText.setVisibility(View.GONE);
        } else {
            dateText.setText(TimeUtils.formatLongDate(scheduled));
            timeText.setText(TimeUtils.formatTime(scheduled));
            timeText.setVisibility(View.VISIBLE);
        }
        card.setVisibility(View.VISIBLE);
    }

    private void renderDetails() {
        // Hides absent API fields instead of showing fabricated station or account details.
        boolean any = false;
        any |= showRow(R.id.summaryStationRow, R.id.summaryStationValue, reservation.stationId);
        any |= showRow(R.id.summarySlotRow, R.id.summarySlotValue, reservation.slotId);
        any |= showRow(R.id.summaryNicRow, R.id.summaryNicValue, reservation.prosumerNic);
        any |= showRow(R.id.summaryCreatedRow, R.id.summaryCreatedValue,
                formatApiTime(reservation.createdAt));
        any |= showRow(R.id.summaryUpdatedRow, R.id.summaryUpdatedValue,
                formatApiTime(reservation.updatedAt));
        findViewById(R.id.summaryDetailsCard).setVisibility(any ? View.VISIBLE : View.GONE);
    }

    private boolean showRow(int rowId, int valueId, @Nullable String value) {
        // One shared row rule keeps the optional booking metadata compact.
        View row = findViewById(rowId);
        if (!hasText(value)) {
            row.setVisibility(View.GONE);
            return false;
        }
        ((TextView) findViewById(valueId)).setText(value);
        row.setVisibility(View.VISIBLE);
        return true;
    }

    @Nullable
    private String formatApiTime(@Nullable String value) {
        // Formatting never changes the stored response value or performs validation.
        if (!hasText(value)) return null;
        Date date = TimeUtils.parseApiDate(value);
        return date == null ? value : getString(R.string.detail_datetime_value,
                TimeUtils.formatLongDate(date), TimeUtils.formatTime(date));
    }

    private static boolean hasText(@Nullable String value) {
        return value != null && !value.trim().isEmpty();
    }

    private void copyReservationId() {
        // Copies the confirmed reference only; no reservation operation is performed.
        if (!hasText(reservation.reservationId)) return;
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (clipboard == null) return;
        clipboard.setPrimaryClip(ClipData.newPlainText(
                getString(R.string.summary_reference_label), reservation.reservationId));
        Snackbar.make(findViewById(R.id.summaryRoot), R.string.detail_copied,
                Snackbar.LENGTH_SHORT).show();
    }

    private void returnHome() {
        // Clears transaction screens so Back cannot reopen a completed create form.
        Navigator.openHome(this, Roles.PROSUMER);
    }
}

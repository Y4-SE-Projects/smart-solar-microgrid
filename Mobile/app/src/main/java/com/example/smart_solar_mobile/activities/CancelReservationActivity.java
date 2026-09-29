// File: CancelReservationActivity.java
// Purpose: Confirms a Prosumer cancellation before calling the Member 03 lifecycle API.

package com.example.smart_solar_mobile.activities;

import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.widget.NestedScrollView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.ReservationStatusUi;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.button.MaterialButton;

import java.util.Date;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CancelReservationActivity extends AppCompatActivity {

    private static final String EXTRA_RESERVATION_ID = "cancel_reservation.id";
    private static final String EXTRA_STATION_ID = "cancel_reservation.station_id";
    private static final String EXTRA_SLOT_ID = "cancel_reservation.slot_id";
    private static final String EXTRA_SCHEDULED_TIME = "cancel_reservation.scheduled_time";
    private static final String EXTRA_STATUS = "cancel_reservation.status";
    private static final String STATE_UNCONFIRMED = "cancel_reservation.unconfirmed_put";

    private String reservationId;
    private boolean sessionReady;
    private boolean submitting;
    private boolean resultUnconfirmed;
    private boolean validBooking;
    private Call<ApiResponse<ReservationData>> cancelCall;
    private AlertDialog finalConfirmationDialog;

    private View bookingContent;
    private NestedScrollView scroll;
    private View unavailableCard;
    private View errorCard;
    private View submittingRow;
    private TextView errorTitle;
    private TextView errorMessage;
    private MaterialButton confirmButton;
    private MaterialButton keepButton;
    private MaterialButton backButton;

    public static Intent intentFor(@NonNull Context context,
                                   @NonNull ReservationData reservation) {
        // Copies only the real booking fields needed to present and submit one cancellation.
        Intent intent = new Intent(context, CancelReservationActivity.class);
        intent.putExtra(EXTRA_RESERVATION_ID, reservation.reservationId);
        intent.putExtra(EXTRA_STATION_ID, reservation.stationId);
        intent.putExtra(EXTRA_SLOT_ID, reservation.slotId);
        intent.putExtra(EXTRA_SCHEDULED_TIME, reservation.scheduledTime);
        intent.putExtra(EXTRA_STATUS, reservation.status);
        return intent;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Rendering and session verification do not perform the cancellation request.
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cancel_reservation);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.cancelRoot));
        bindViews();

        Intent intent = getIntent();
        reservationId = intent.getStringExtra(EXTRA_RESERVATION_ID);
        String stationId = intent.getStringExtra(EXTRA_STATION_ID);
        String slotId = intent.getStringExtra(EXTRA_SLOT_ID);
        String scheduledTime = intent.getStringExtra(EXTRA_SCHEDULED_TIME);
        String status = intent.getStringExtra(EXTRA_STATUS);
        validBooking = hasText(reservationId) && hasText(stationId)
                && hasText(slotId) && hasText(scheduledTime)
                && ("Pending".equalsIgnoreCase(status)
                || "Approved".equalsIgnoreCase(status));
        resultUnconfirmed = savedInstanceState != null
                && savedInstanceState.getBoolean(STATE_UNCONFIRMED);

        backButton.setOnClickListener(view -> leave());
        keepButton.setOnClickListener(view -> leave());
        confirmButton.setOnClickListener(view -> showFinalConfirmation());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Back follows the safe secondary action while the API request is in flight.
                leave();
            }
        });

        if (validBooking) {
            renderBooking(stationId, slotId, scheduledTime, status);
        } else {
            bookingContent.setVisibility(View.GONE);
            unavailableCard.setVisibility(View.VISIBLE);
        }
        if (resultUnconfirmed) {
            showError(R.string.cancel_unconfirmed_title,
                    getString(R.string.cancel_unconfirmed_body));
        }
        updateActions();

        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) return;
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || !hasText(session.identifier)) {
                Navigator.openLogin(this, false);
                return;
            }
            sessionReady = true;
            updateActions();
        });
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // An in-flight PUT may have reached the API even if recreation loses its response.
        super.onSaveInstanceState(outState);
        outState.putBoolean(STATE_UNCONFIRMED, submitting || resultUnconfirmed);
    }

    @Override
    protected void onDestroy() {
        // Dismisses the review dialog and prevents callbacks from updating a destroyed Activity.
        if (finalConfirmationDialog != null) finalConfirmationDialog.dismiss();
        if (cancelCall != null) cancelCall.cancel();
        super.onDestroy();
    }

    private void bindViews() {
        // Resolves the confirmation, progress, and inline error views.
        bookingContent = findViewById(R.id.cancelBookingContent);
        scroll = findViewById(R.id.cancelScroll);
        unavailableCard = findViewById(R.id.cancelUnavailableCard);
        errorCard = findViewById(R.id.cancelErrorCard);
        submittingRow = findViewById(R.id.cancelSubmittingRow);
        errorTitle = findViewById(R.id.cancelErrorTitle);
        errorMessage = findViewById(R.id.cancelErrorMessage);
        confirmButton = findViewById(R.id.cancelConfirmButton);
        keepButton = findViewById(R.id.cancelKeepButton);
        backButton = findViewById(R.id.cancelBackButton);
    }

    private void renderBooking(String stationId, String slotId,
                               String scheduledTime, String status) {
        // Shows only the booking values handed off from the live reservation response.
        ((TextView) findViewById(R.id.cancelReferenceText)).setText(reservationId);
        ((TextView) findViewById(R.id.cancelStationText)).setText(stationId);
        ((TextView) findViewById(R.id.cancelSlotText)).setText(slotId);

        Date scheduled = TimeUtils.parseApiDate(scheduledTime);
        TextView dateText = findViewById(R.id.cancelDateText);
        TextView timeText = findViewById(R.id.cancelTimeText);
        if (scheduled != null) {
            dateText.setText(TimeUtils.formatLongDate(scheduled));
            timeText.setText(TimeUtils.formatTime(scheduled));
        } else {
            dateText.setText(scheduledTime);
            timeText.setVisibility(View.GONE);
        }

        TextView chip = findViewById(R.id.cancelStatusChip);
        chip.setText(ReservationStatusUi.chipLabel(status));
        chip.setBackgroundResource(ReservationStatusUi.chipBackground(status));
        chip.setTextColor(ContextCompat.getColor(this,
                ReservationStatusUi.chipTextColor(status)));
    }

    private void showFinalConfirmation() {
        // The page action opens one dismissible dialog; no request is sent until its final action.
        if (!validBooking || !sessionReady || submitting || resultUnconfirmed
                || (finalConfirmationDialog != null && finalConfirmationDialog.isShowing())) return;

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(R.string.cancel_final_title)
                .setMessage(R.string.cancel_final_message)
                .setNegativeButton(R.string.cancel_keep_action, null)
                .setPositiveButton(R.string.cancel_confirm_action,
                        (ignoredDialog, ignoredButton) -> confirmCancellation())
                .setCancelable(true)
                .create();
        finalConfirmationDialog = dialog;
        dialog.setOnShowListener(ignored -> {
            dialog.getButton(DialogInterface.BUTTON_NEGATIVE)
                    .setTextColor(ContextCompat.getColor(this, R.color.primary));
            dialog.getButton(DialogInterface.BUTTON_POSITIVE)
                    .setTextColor(ContextCompat.getColor(this, R.color.alert_danger));
        });
        dialog.setOnDismissListener(ignored -> {
            if (finalConfirmationDialog == dialog) finalConfirmationDialog = null;
        });
        dialog.show();
    }

    private void confirmCancellation() {
        // The sole mutation entry point; the route uses the public reservationId.
        if (!validBooking || !sessionReady || submitting || resultUnconfirmed) return;
        submitting = true;
        errorCard.setVisibility(View.GONE);
        updateActions();

        cancelCall = NetworkManager.getInstance().getApiService()
                .cancelReservation(reservationId.trim());
        final Call<ApiResponse<ReservationData>> call = cancelCall;
        call.enqueue(new Callback<ApiResponse<ReservationData>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<ReservationData>> request,
                                   @NonNull Response<ApiResponse<ReservationData>> response) {
                if (isFinishing() || isDestroyed() || call != cancelCall
                        || call.isCanceled()) return;
                submitting = false;
                ApiResponse<ReservationData> body = response.body();
                if (response.isSuccessful() && body != null && body.success
                        && body.data != null && hasText(body.data.reservationId)
                        && "Cancelled".equalsIgnoreCase(body.data.status)) {
                    ReservationSummaryActivity.open(CancelReservationActivity.this,
                            ReservationSummaryActivity.Action.CANCEL, body.data);
                    finish();
                    return;
                }
                updateActions();
                if (!response.isSuccessful()) {
                    showError(R.string.cancel_error_title,
                            ApiErrorParser.getMessage(CancelReservationActivity.this, response));
                } else {
                    if (body != null && body.success) {
                        resultUnconfirmed = true;
                        updateActions();
                    }
                    showError(R.string.cancel_error_title,
                            body != null && !body.success && hasText(body.message) ? body.message
                                    : getString(R.string.cancel_incomplete_response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<ReservationData>> request,
                                  @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != cancelCall
                        || call.isCanceled()) return;
                submitting = false;
                resultUnconfirmed = true;
                updateActions();
                showError(R.string.cancel_unconfirmed_title,
                        getString(R.string.cancel_network_unconfirmed));
            }
        });
    }

    private void showError(int titleRes, String message) {
        // Keeps server validation visible, including the API's 12-hour rejection.
        errorTitle.setText(titleRes);
        errorMessage.setText(message);
        errorCard.setVisibility(View.VISIBLE);
        errorCard.announceForAccessibility(message);
        scroll.post(() -> scroll.smoothScrollTo(0, errorCard.getTop()));
    }

    private void updateActions() {
        // A disabled confirmation control also prevents duplicate in-flight requests.
        confirmButton.setVisibility(validBooking ? View.VISIBLE : View.GONE);
        boolean canConfirm = validBooking && sessionReady
                && !submitting && !resultUnconfirmed;
        confirmButton.setEnabled(canConfirm);
        confirmButton.setAlpha(canConfirm ? 1f : 0.55f);
        confirmButton.setText(submitting ? R.string.cancel_submitting
                : R.string.cancel_confirm_action);
        keepButton.setEnabled(!submitting);
        backButton.setEnabled(!submitting);
        keepButton.setText(resultUnconfirmed ? R.string.cancel_return_home
                : validBooking ? R.string.cancel_keep_action : R.string.cancel_go_back);
        submittingRow.setVisibility(submitting ? View.VISIBLE : View.GONE);
    }

    private void leave() {
        // A user may leave safely before confirmation; an in-flight request stays on screen.
        if (submitting) return;
        if (resultUnconfirmed) {
            Navigator.openHome(this, Roles.PROSUMER);
        } else {
            finish();
        }
    }

    private static boolean hasText(String value) {
        // Rejects missing handoff data without inventing booking details.
        return value != null && !value.trim().isEmpty();
    }
}

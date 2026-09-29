// File: ReservationDetailActivity.java
// Purpose: Prosumer screen for one reservation — its status, summary, and (once Approved) its live QR pass.

package com.example.smart_solar_mobile.activities;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.QrResponse;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.ReservationStatusUi;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.button.MaterialButton;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

import java.util.Date;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ReservationDetailActivity extends AppCompatActivity {

    private static final String EXTRA_RESERVATION_ID = "reservation_id";
    private static final String EXTRA_STATION_ID = "station_id";
    private static final String EXTRA_SCHEDULED_TIME = "scheduled_time";
    private static final String EXTRA_STATUS = "status";
    private static final String EXTRA_PROSUMER_NIC = "prosumer_nic";

    private static final int QR_IMAGE_SIZE_PX = 720;

    // Launches the detail screen for one reservation, carrying only what's already on screen —
    // no extra network round trip is needed to show the summary.
    public static void start(Context context, ReservationData reservation) {
        Intent intent = new Intent(context, ReservationDetailActivity.class);
        intent.putExtra(EXTRA_RESERVATION_ID, reservation.reservationId);
        intent.putExtra(EXTRA_STATION_ID, reservation.stationId);
        intent.putExtra(EXTRA_SCHEDULED_TIME, reservation.scheduledTime);
        intent.putExtra(EXTRA_STATUS, reservation.status);
        intent.putExtra(EXTRA_PROSUMER_NIC, reservation.prosumerNic);
        context.startActivity(intent);
    }

    private String reservationId;
    private String status;
    private Call<ApiResponse<QrResponse>> qrCall;

    private TextView detailReferenceText;
    private TextView statusTitleText;
    private TextView statusChip;
    private TextView statusBodyText;
    private TextView stationValueText;
    private TextView dateTimeValueText;
    private TextView nicValueText;

    private View qrCard;
    private View qrLockedState;
    private View qrLoadingState;
    private View qrActiveState;
    private View qrUsedState;
    private View qrErrorState;
    private ImageView qrImage;
    private TextView qrErrorMessageText;
    private MaterialButton regenerateQrButton;
    private MaterialButton retryQrButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reservation_detail);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.detailRoot));
        bindViews();

        Intent intent = getIntent();
        reservationId = intent.getStringExtra(EXTRA_RESERVATION_ID);
        status = intent.getStringExtra(EXTRA_STATUS);
        String stationId = intent.getStringExtra(EXTRA_STATION_ID);
        String scheduledTime = intent.getStringExtra(EXTRA_SCHEDULED_TIME);
        String prosumerNic = intent.getStringExtra(EXTRA_PROSUMER_NIC);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        findViewById(R.id.copyIdButton).setOnClickListener(v -> copyReservationId());
        findViewById(R.id.viewBookingsButton).setOnClickListener(v -> finish());
        findViewById(R.id.backHomeButton).setOnClickListener(v ->
                Navigator.openHome(this, Roles.PROSUMER));
        retryQrButton.setOnClickListener(v -> loadQr());
        regenerateQrButton.setOnClickListener(v -> confirmRegenerate());

        renderSummary(stationId, scheduledTime, prosumerNic);
        renderStatus();
        renderQrCard();

        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            if (session == null || !Roles.PROSUMER.equals(session.role)) {
                Navigator.openLogin(this, false);
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (qrCall != null) qrCall.cancel();
        super.onDestroy();
    }

    private void bindViews() {
        detailReferenceText = findViewById(R.id.detailReferenceText);
        statusTitleText = findViewById(R.id.statusTitleText);
        statusChip = findViewById(R.id.statusChip);
        statusBodyText = findViewById(R.id.statusBodyText);
        stationValueText = findViewById(R.id.stationValueText);
        dateTimeValueText = findViewById(R.id.dateTimeValueText);
        nicValueText = findViewById(R.id.nicValueText);

        qrCard = findViewById(R.id.qrCard);
        qrLockedState = findViewById(R.id.qrLockedState);
        qrLoadingState = findViewById(R.id.qrLoadingState);
        qrActiveState = findViewById(R.id.qrActiveState);
        qrUsedState = findViewById(R.id.qrUsedState);
        qrErrorState = findViewById(R.id.qrErrorState);
        qrImage = findViewById(R.id.qrImage);
        qrErrorMessageText = findViewById(R.id.qrErrorMessageText);
        regenerateQrButton = findViewById(R.id.regenerateQrButton);
        retryQrButton = findViewById(R.id.retryQrButton);
    }

    private void renderSummary(String stationId, String scheduledTime, String prosumerNic) {
        detailReferenceText.setText(getString(R.string.detail_reference, reservationId));
        stationValueText.setText(stationId);
        nicValueText.setText(prosumerNic);

        Date scheduled = TimeUtils.parseApiDate(scheduledTime);
        dateTimeValueText.setText(scheduled == null
                ? getString(R.string.metric_empty)
                : getString(R.string.detail_datetime_value,
                        TimeUtils.formatLongDate(scheduled), TimeUtils.formatTime(scheduled)));
    }

    private void renderStatus() {
        statusChip.setBackgroundResource(ReservationStatusUi.chipBackground(status));
        statusChip.setTextColor(getColor(ReservationStatusUi.chipTextColor(status)));
        statusChip.setText(ReservationStatusUi.chipLabel(status));

        int title;
        int body;
        if ("Approved".equalsIgnoreCase(status)) {
            title = R.string.detail_status_approved_title;
            body = R.string.detail_status_approved_body;
        } else if ("Completed".equalsIgnoreCase(status)) {
            title = R.string.detail_status_completed_title;
            body = R.string.detail_status_completed_body;
        } else if ("Declined".equalsIgnoreCase(status)) {
            title = R.string.detail_status_declined_title;
            body = R.string.detail_status_declined_body;
        } else if ("Cancelled".equalsIgnoreCase(status)) {
            title = R.string.detail_status_cancelled_title;
            body = R.string.detail_status_cancelled_body;
        } else if ("Expired".equalsIgnoreCase(status)) {
            title = R.string.detail_status_expired_title;
            body = R.string.detail_status_expired_body;
        } else {
            title = R.string.detail_status_pending_title;
            body = R.string.detail_status_pending_body;
        }
        statusTitleText.setText(title);
        statusBodyText.setText(body);
    }

    // The QR card only ever appears for a reservation that can still use one, or already did.
    private void renderQrCard() {
        if ("Declined".equalsIgnoreCase(status) || "Cancelled".equalsIgnoreCase(status)
                || "Expired".equalsIgnoreCase(status)) {
            qrCard.setVisibility(View.GONE);
            return;
        }

        qrCard.setVisibility(View.VISIBLE);
        if ("Approved".equalsIgnoreCase(status)) {
            loadQr();
        } else if ("Completed".equalsIgnoreCase(status)) {
            showQrState(qrUsedState);
        } else {
            showQrState(qrLockedState);
        }
    }

    private void loadQr() {
        showQrState(qrLoadingState);
        if (qrCall != null) qrCall.cancel();

        qrCall = NetworkManager.getInstance().getApiService().getQr(reservationId);
        final Call<ApiResponse<QrResponse>> call = qrCall;
        call.enqueue(new Callback<ApiResponse<QrResponse>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<QrResponse>> request,
                                    @NonNull Response<ApiResponse<QrResponse>> response) {
                if (isFinishing() || isDestroyed() || call != qrCall || call.isCanceled()) {
                    return;
                }
                ApiResponse<QrResponse> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null
                        || body.data.qrCodeData == null || body.data.qrCodeData.isEmpty()) {
                    showQrError(ApiErrorParser.getMessage(ReservationDetailActivity.this, response));
                    return;
                }
                showQrBitmap(body.data.qrCodeData);
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<QrResponse>> request, @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != qrCall || call.isCanceled()) {
                    return;
                }
                showQrError(getString(R.string.error_network));
            }
        });
    }

    private void confirmRegenerate() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.detail_regenerate_confirm_title)
                .setMessage(R.string.detail_regenerate_confirm_body)
                .setPositiveButton(R.string.continue_action, (dialog, which) -> regenerateQr())
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void regenerateQr() {
        regenerateQrButton.setEnabled(false);
        regenerateQrButton.setText(R.string.detail_regenerating_qr);
        if (qrCall != null) qrCall.cancel();

        qrCall = NetworkManager.getInstance().getApiService().regenerateQr(reservationId);
        final Call<ApiResponse<QrResponse>> call = qrCall;
        call.enqueue(new Callback<ApiResponse<QrResponse>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<QrResponse>> request,
                                    @NonNull Response<ApiResponse<QrResponse>> response) {
                if (isFinishing() || isDestroyed() || call != qrCall || call.isCanceled()) {
                    return;
                }
                resetRegenerateButton();
                ApiResponse<QrResponse> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null
                        || body.data.qrCodeData == null || body.data.qrCodeData.isEmpty()) {
                    Toast.makeText(ReservationDetailActivity.this,
                            ApiErrorParser.getMessage(ReservationDetailActivity.this, response),
                            Toast.LENGTH_LONG).show();
                    return;
                }
                showQrBitmap(body.data.qrCodeData);
                Toast.makeText(ReservationDetailActivity.this,
                        R.string.detail_regenerate_success, Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<QrResponse>> request, @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != qrCall || call.isCanceled()) {
                    return;
                }
                resetRegenerateButton();
                Toast.makeText(ReservationDetailActivity.this, R.string.error_network, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void resetRegenerateButton() {
        regenerateQrButton.setEnabled(true);
        regenerateQrButton.setText(R.string.detail_regenerate_qr);
    }

    private void showQrBitmap(String qrCodeData) {
        Bitmap bitmap = generateQrBitmap(qrCodeData);
        if (bitmap == null) {
            showQrError(getString(R.string.detail_qr_error_title));
            return;
        }
        qrImage.setImageBitmap(bitmap);
        showQrState(qrActiveState);
    }

    private void showQrError(String message) {
        qrErrorMessageText.setText(message);
        showQrState(qrErrorState);
    }

    private void showQrState(View toShow) {
        qrLockedState.setVisibility(toShow == qrLockedState ? View.VISIBLE : View.GONE);
        qrLoadingState.setVisibility(toShow == qrLoadingState ? View.VISIBLE : View.GONE);
        qrActiveState.setVisibility(toShow == qrActiveState ? View.VISIBLE : View.GONE);
        qrUsedState.setVisibility(toShow == qrUsedState ? View.VISIBLE : View.GONE);
        qrErrorState.setVisibility(toShow == qrErrorState ? View.VISIBLE : View.GONE);
    }

    // Encodes the signed payload on-device; the app never constructs or interprets the payload itself.
    private Bitmap generateQrBitmap(String content) {
        try {
            BitMatrix matrix = new QRCodeWriter().encode(
                    content, BarcodeFormat.QR_CODE, QR_IMAGE_SIZE_PX, QR_IMAGE_SIZE_PX);
            Bitmap bitmap = Bitmap.createBitmap(QR_IMAGE_SIZE_PX, QR_IMAGE_SIZE_PX, Bitmap.Config.RGB_565);
            for (int x = 0; x < QR_IMAGE_SIZE_PX; x++) {
                for (int y = 0; y < QR_IMAGE_SIZE_PX; y++) {
                    bitmap.setPixel(x, y, matrix.get(x, y) ? Color.BLACK : Color.WHITE);
                }
            }
            return bitmap;
        } catch (WriterException e) {
            return null;
        }
    }

    private void copyReservationId() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText("Reservation ID", reservationId));
        Toast.makeText(this, R.string.detail_copied, Toast.LENGTH_SHORT).show();
    }
}

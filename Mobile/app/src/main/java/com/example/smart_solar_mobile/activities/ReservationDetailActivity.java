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
import com.example.smart_solar_mobile.db.AppDatabase;
import com.example.smart_solar_mobile.db.ReservationCacheDao;
import com.example.smart_solar_mobile.models.QrResponse;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.ConnectivityRetryObserver;
import com.example.smart_solar_mobile.utils.ReservationStatusUi;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.button.MaterialButton;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

import java.util.Date;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ReservationDetailActivity extends AppCompatActivity {

    private static final String EXTRA_RESERVATION_ID = "reservation_id";
    private static final String EXTRA_STATION_ID = "station_id";
    private static final String EXTRA_SLOT_ID = "slot_id";
    private static final String EXTRA_SCHEDULED_TIME = "scheduled_time";
    private static final String EXTRA_STATUS = "status";
    private static final String EXTRA_PROSUMER_NIC = "prosumer_nic";
    private static final String EXTRA_CREATED_AT = "created_at";

    private static final int QR_IMAGE_SIZE_PX = 1024;

    // The passed fields are a read-only snapshot until this screen verifies the live record.
    public static void start(Context context, ReservationData reservation) {
        Intent intent = new Intent(context, ReservationDetailActivity.class);
        intent.putExtra(EXTRA_RESERVATION_ID, reservation.reservationId);
        intent.putExtra(EXTRA_STATION_ID, reservation.stationId);
        intent.putExtra(EXTRA_SLOT_ID, reservation.slotId);
        intent.putExtra(EXTRA_SCHEDULED_TIME, reservation.scheduledTime);
        intent.putExtra(EXTRA_STATUS, reservation.status);
        intent.putExtra(EXTRA_PROSUMER_NIC, reservation.prosumerNic);
        intent.putExtra(EXTRA_CREATED_AT, reservation.createdAt);
        context.startActivity(intent);
    }

    private String reservationId;
    private String status;
    private String snapshotNic;
    private ReservationData editReservation;
    private boolean canOpenEdit;
    private boolean canOpenCancel;
    private boolean freshDetail;
    private boolean detailSyncing;
    private boolean detailSyncFailed;
    private long detailGeneration;
    private ConnectivityRetryObserver connectivityRetryObserver;
    private ReservationCacheDao reservationCacheDao;
    private final ExecutorService cacheExecutor = Executors.newSingleThreadExecutor();
    private Call<ApiResponse<List<ReservationData>>> detailCall;
    private Call<ApiResponse<QrResponse>> qrCall;
    private View syncBanner;
    private TextView syncText;
    private MaterialButton syncRetryButton;

    private TextView detailReferenceText;
    private TextView statusChip;
    private TextView stationValueText;
    private TextView dateTimeValueText;
    private TextView nicValueText;
    private MaterialButton editBookingButton;
    private MaterialButton cancelBookingButton;

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
        reservationCacheDao = AppDatabase.getInstance(this).reservationCacheDao();

        Intent intent = getIntent();
        reservationId = intent.getStringExtra(EXTRA_RESERVATION_ID);
        status = intent.getStringExtra(EXTRA_STATUS);
        String stationId = intent.getStringExtra(EXTRA_STATION_ID);
        String scheduledTime = intent.getStringExtra(EXTRA_SCHEDULED_TIME);
        String prosumerNic = intent.getStringExtra(EXTRA_PROSUMER_NIC);
        snapshotNic = prosumerNic;
        // Retains the real history record fields needed by the existing Member 03 edit launcher.
        editReservation = new ReservationData();
        editReservation.reservationId = reservationId;
        editReservation.stationId = stationId;
        editReservation.slotId = intent.getStringExtra(EXTRA_SLOT_ID);
        editReservation.scheduledTime = scheduledTime;
        editReservation.status = status;
        editReservation.prosumerNic = prosumerNic;
        editReservation.createdAt = intent.getStringExtra(EXTRA_CREATED_AT);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        findViewById(R.id.copyIdButton).setOnClickListener(v -> copyReservationId());
        findViewById(R.id.viewBookingsButton).setOnClickListener(v -> finish());
        findViewById(R.id.backHomeButton).setOnClickListener(v ->
                Navigator.openHome(this, Roles.PROSUMER));
        editBookingButton.setOnClickListener(v -> {
            if (canOpenEdit) {
                startActivity(EditReservationActivity.intentFor(this, editReservation));
            }
        });
        cancelBookingButton.setOnClickListener(v -> {
            if (canOpenCancel) {
                startActivity(CancelReservationActivity.intentFor(this, editReservation));
            }
        });
        retryQrButton.setOnClickListener(v -> { if (freshDetail) loadQr(); else refreshDetail(); });
        regenerateQrButton.setOnClickListener(v -> { if (freshDetail) confirmRegenerate(); });
        syncRetryButton.setOnClickListener(v -> refreshDetail());
        connectivityRetryObserver = new ConnectivityRetryObserver(this,
                () -> { if (detailSyncFailed && !detailSyncing) refreshDetail(); },
                () -> { if (freshDetail) showDetailStale(R.string.detail_stale); });
        findViewById(R.id.detailRoot).setVisibility(View.INVISIBLE);
    }

    @Override
    protected void onResume() {
        // A cached or passed status never authorizes actions until this activation's API GET succeeds.
        super.onResume();
        final long currentGeneration = ++detailGeneration;
        freshDetail = false;
        detailSyncFailed = false;
        detailSyncing = false;
        hideServerActions();
        findViewById(R.id.detailRoot).setVisibility(View.INVISIBLE);
        connectivityRetryObserver.start();
        SessionManager.getInstance().loadSession(session -> {
            if (currentGeneration != detailGeneration || isFinishing() || isDestroyed()) return;
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || !hasText(session.identifier)) {
                Navigator.openLogin(this, false);
                return;
            }
            if (!session.identifier.equals(snapshotNic)) {
                // A late Intent from another account must not display that account's details.
                finish();
                return;
            }
            findViewById(R.id.detailRoot).setVisibility(View.VISIBLE);
            renderSummary(editReservation.stationId, editReservation.scheduledTime, snapshotNic);
            renderStatus();
            refreshDetail();
        });
    }

    @Override
    protected void onStop() {
        connectivityRetryObserver.stop();
        detailGeneration++;
        if (detailCall != null) detailCall.cancel();
        if (qrCall != null) qrCall.cancel();
        hideServerActions();
        findViewById(R.id.detailRoot).setVisibility(View.INVISIBLE);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (detailCall != null) detailCall.cancel();
        if (qrCall != null) qrCall.cancel();
        cacheExecutor.shutdown();
        super.onDestroy();
    }

    private void bindViews() {
        detailReferenceText = findViewById(R.id.detailReferenceText);
        statusChip = findViewById(R.id.statusChip);
        stationValueText = findViewById(R.id.stationValueText);
        dateTimeValueText = findViewById(R.id.dateTimeValueText);
        nicValueText = findViewById(R.id.nicValueText);
        editBookingButton = findViewById(R.id.detailEditBookingButton);
        cancelBookingButton = findViewById(R.id.detailCancelBookingButton);

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
        syncBanner = findViewById(R.id.detailSyncBanner);
        syncText = findViewById(R.id.detailSyncText);
        syncRetryButton = findViewById(R.id.detailSyncRetryButton);
    }

    private void refreshDetail() {
        // Recheck the complete, owner-scoped history before showing Edit, Cancel or live QR.
        if (!hasText(snapshotNic) || !hasText(reservationId)) return;
        if (detailCall != null) detailCall.cancel();
        if (qrCall != null) qrCall.cancel();
        hideServerActions();
        detailSyncing = true;
        detailSyncFailed = false;
        syncBanner.setVisibility(View.VISIBLE);
        syncRetryButton.setVisibility(View.GONE);
        syncText.setText(R.string.detail_syncing);
        final long currentGeneration = detailGeneration;
        detailCall = NetworkManager.getInstance().getApiService()
                .getProsumerReservations(snapshotNic);
        final Call<ApiResponse<List<ReservationData>>> call = detailCall;
        call.enqueue(new Callback<ApiResponse<List<ReservationData>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                   @NonNull Response<ApiResponse<List<ReservationData>>> response) {
                if (obsoleteDetail(call, currentGeneration)) return;
                ApiResponse<List<ReservationData>> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null) {
                    if (response.code() == 401 || response.code() == 403) {
                        // Do not reveal a saved snapshot if the server denies current access.
                        finish();
                        return;
                    }
                    showDetailStale(R.string.detail_stale);
                    return;
                }
                ReservationData current = null;
                for (ReservationData row : body.data) {
                    if (row != null && reservationId.equals(row.reservationId)
                            && snapshotNic.equals(row.prosumerNic)) {
                        current = row;
                        break;
                    }
                }
                if (current == null) {
                    showDetailStale(R.string.detail_missing);
                    return;
                }
                final long syncedAt = System.currentTimeMillis();
                cacheExecutor.execute(() -> {
                    try {
                        reservationCacheDao.replaceForProsumer(snapshotNic, body.data, syncedAt);
                    } catch (RuntimeException ignored) {
                        // Detail may still use its fresh API result if local persistence fails.
                    }
                });
                editReservation = current;
                status = current.status;
                detailSyncing = false;
                detailSyncFailed = false;
                freshDetail = true;
                syncBanner.setVisibility(View.GONE);
                renderSummary(current.stationId, current.scheduledTime, snapshotNic);
                renderStatus();
                showServerActions();
                renderQrCard();
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                  @NonNull Throwable error) {
                if (!obsoleteDetail(call, currentGeneration)) showDetailStale(R.string.detail_stale);
            }
        });
    }

    private boolean obsoleteDetail(Call<?> call, long currentGeneration) {
        return isFinishing() || isDestroyed() || call != detailCall || call.isCanceled()
                || currentGeneration != detailGeneration;
    }

    private void hideServerActions() {
        // Never leave an old status, QR image or action enabled while data is stale or syncing.
        freshDetail = false;
        canOpenEdit = false;
        canOpenCancel = false;
        editBookingButton.setVisibility(View.GONE);
        cancelBookingButton.setVisibility(View.GONE);
        qrCard.setVisibility(View.GONE);
        qrImage.setImageDrawable(null);
    }

    private void showServerActions() {
        // These buttons are based on a fresh owner-scoped GET; mutations still go through the API.
        canOpenEdit = "Pending".equalsIgnoreCase(editReservation.status)
                && hasText(editReservation.reservationId)
                && hasText(editReservation.stationId)
                && hasText(editReservation.slotId)
                && hasText(editReservation.scheduledTime);
        canOpenCancel = ("Pending".equalsIgnoreCase(editReservation.status)
                || "Approved".equalsIgnoreCase(editReservation.status))
                && hasText(editReservation.reservationId)
                && hasText(editReservation.stationId)
                && hasText(editReservation.slotId)
                && hasText(editReservation.scheduledTime);
        editBookingButton.setVisibility(canOpenEdit ? View.VISIBLE : View.GONE);
        cancelBookingButton.setVisibility(canOpenCancel ? View.VISIBLE : View.GONE);
    }

    private void showDetailStale(int messageRes) {
        if (detailCall != null) detailCall.cancel();
        if (qrCall != null) qrCall.cancel();
        detailSyncing = false;
        detailSyncFailed = true;
        hideServerActions();
        syncText.setText(messageRes);
        syncRetryButton.setVisibility(View.VISIBLE);
        syncBanner.setVisibility(View.VISIBLE);
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
        if (!freshDetail) return;
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
        if (!freshDetail) return;
        new AlertDialog.Builder(this)
                .setTitle(R.string.detail_regenerate_confirm_title)
                .setMessage(R.string.detail_regenerate_confirm_body)
                .setPositiveButton(R.string.continue_action, (dialog, which) -> regenerateQr())
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void regenerateQr() {
        if (!freshDetail) return;
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

    private static boolean hasText(String value) {
        // Keeps the edit entry hidden when a required field was absent from the history record.
        return value != null && !value.trim().isEmpty();
    }
}

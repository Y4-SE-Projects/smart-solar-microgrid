// File: ScanQrActivity.java
// Purpose: Grid Operator screen that scans a prosumer's QR pass and finalizes the transfer.
// The app never parses or judges the QR itself — it sends the raw decoded text to the API and
// only ever displays whatever the API decides.

package com.example.smart_solar_mobile.activities;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.models.SolarStation;
import com.example.smart_solar_mobile.models.VerifyQrRequest;
import com.example.smart_solar_mobile.models.VerifyQrResponse;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.button.MaterialButton;
import com.google.zxing.ResultPoint;
import com.journeyapps.barcodescanner.BarcodeCallback;
import com.journeyapps.barcodescanner.BarcodeResult;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;

import java.util.Date;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ScanQrActivity extends AppCompatActivity {

    private static final String EXTRA_STATION_ID = "station_id";
    private static final String EXTRA_STATION_NAME = "station_name";

    public static Intent intentFor(Context context, SolarStation station) {
        Intent intent = new Intent(context, ScanQrActivity.class);
        if (station != null) {
            intent.putExtra(EXTRA_STATION_ID, station.stationId);
            intent.putExtra(EXTRA_STATION_NAME, station.name);
        }
        return intent;
    }

    private final ActivityResultLauncher<String> requestCameraPermission = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(), this::onCameraPermissionResult);

    private final BarcodeCallback barcodeCallback = new BarcodeCallback() {
        @Override
        public void barcodeResult(BarcodeResult result) {
            onQrDecoded(result.getText());
        }

        @Override
        public void possibleResultPoints(List<ResultPoint> resultPoints) {
            // Not used
        }
    };

    private DecoratedBarcodeView barcodeScanner;
    private View permissionDeniedView;
    private TextView permissionMessageText;
    private MaterialButton grantPermissionButton;
    private TextView scanSubtitleText;
    private TextView scanStatusChip;
    private View scanWorkspace;
    private View scanVerifyingView;

    private View resultCard;
    private ImageView resultIcon;
    private TextView resultTitleText;
    private TextView resultChipText;
    private TextView resultMessageText;
    private View resultDetails;
    private TextView resultReservationCodeText;
    private TextView resultProsumerText;
    private TextView resultStationText;
    private TextView resultScheduledTimeText;
    private TextView resultStatusText;
    private MaterialButton scanNextButton;

    private Call<ApiResponse<VerifyQrResponse>> verifyCall;
    private boolean cameraPermissionGranted;
    private boolean showingResult;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_scan_qr);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.scanRoot));
        bindViews();

        String stationId = getIntent().getStringExtra(EXTRA_STATION_ID);
        String stationName = getIntent().getStringExtra(EXTRA_STATION_NAME);
        scanSubtitleText.setText(stationId == null
                ? getString(R.string.scan_subtitle_no_station)
                : getString(R.string.scan_subtitle, stationName == null ? stationId
                        : getString(R.string.station_meta, stationId, stationName)));
        setReadyChip();

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        findViewById(R.id.closeButton).setOnClickListener(v -> finish());
        grantPermissionButton.setOnClickListener(v -> requestCameraPermission.launch(Manifest.permission.CAMERA));
        scanNextButton.setOnClickListener(v -> resumeScanning());

        barcodeScanner.decodeSingle(barcodeCallback);

        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            if (session == null || !Roles.GRID_OPERATOR.equals(session.role)) {
                Navigator.openLogin(this, false);
            }
        });

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            cameraPermissionGranted = true;
        } else {
            requestCameraPermission.launch(Manifest.permission.CAMERA);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (cameraPermissionGranted && !showingResult) {
            barcodeScanner.resume();
        }
    }

    @Override
    protected void onPause() {
        barcodeScanner.pause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (verifyCall != null) verifyCall.cancel();
        super.onDestroy();
    }

    private void bindViews() {
        barcodeScanner = findViewById(R.id.barcodeScanner);
        permissionDeniedView = findViewById(R.id.permissionDeniedView);
        permissionMessageText = findViewById(R.id.permissionMessageText);
        grantPermissionButton = findViewById(R.id.grantPermissionButton);
        scanSubtitleText = findViewById(R.id.scanSubtitleText);
        scanStatusChip = findViewById(R.id.scanStatusChip);
        scanWorkspace = findViewById(R.id.scanWorkspace);
        scanVerifyingView = findViewById(R.id.scanVerifyingView);

        resultCard = findViewById(R.id.resultCard);
        resultIcon = findViewById(R.id.resultIcon);
        resultTitleText = findViewById(R.id.resultTitleText);
        resultChipText = findViewById(R.id.resultChipText);
        resultMessageText = findViewById(R.id.resultMessageText);
        resultDetails = findViewById(R.id.resultDetails);
        resultReservationCodeText = findViewById(R.id.resultReservationCodeText);
        resultProsumerText = findViewById(R.id.resultProsumerText);
        resultStationText = findViewById(R.id.resultStationText);
        resultScheduledTimeText = findViewById(R.id.resultScheduledTimeText);
        resultStatusText = findViewById(R.id.resultStatusText);
        scanNextButton = findViewById(R.id.scanNextButton);
    }

    private void onCameraPermissionResult(boolean granted) {
        cameraPermissionGranted = granted;
        permissionDeniedView.setVisibility(granted ? View.GONE : View.VISIBLE);
        if (granted && !showingResult) {
            barcodeScanner.resume();
        } else if (!granted) {
            permissionMessageText.setText(R.string.scan_permission_denied);
        }
    }

    private void setReadyChip() {
        scanStatusChip.setBackgroundResource(R.drawable.bg_chip_active);
        scanStatusChip.setTextColor(getColor(R.color.primary_container));
        scanStatusChip.setText(R.string.scan_ready);
    }

    // Fires at most once per decode: decodeSingle stops calling back until it's armed again.
    private void onQrDecoded(String qrCodeData) {
        runOnUiThread(() -> verifyQr(qrCodeData));
    }

    private void verifyQr(String qrCodeData) {
        showingResult = true;
        scanVerifyingView.setVisibility(View.VISIBLE);
        if (verifyCall != null) verifyCall.cancel();

        verifyCall = NetworkManager.getInstance().getApiService().verifyQr(new VerifyQrRequest(qrCodeData));
        final Call<ApiResponse<VerifyQrResponse>> call = verifyCall;
        call.enqueue(new Callback<ApiResponse<VerifyQrResponse>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<VerifyQrResponse>> request,
                                    @NonNull Response<ApiResponse<VerifyQrResponse>> response) {
                if (isFinishing() || isDestroyed() || call != verifyCall || call.isCanceled()) {
                    return;
                }
                ApiResponse<VerifyQrResponse> body = response.body();
                if (response.isSuccessful() && body != null && body.success && body.data != null) {
                    showVerifiedResult(body.data);
                } else if (response.isSuccessful() || response.code() >= 500) {
                    showUnavailableResult(ApiErrorParser.getMessage(ScanQrActivity.this, response));
                } else {
                    showRejectedResult(ApiErrorParser.getMessage(ScanQrActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<VerifyQrResponse>> request, @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != verifyCall || call.isCanceled()) {
                    return;
                }
                showUnavailableResult(getString(R.string.error_network));
            }
        });
    }

    private void showVerifiedResult(VerifyQrResponse data) {
        // The result border reflects the API verdict; verification behavior is unchanged.
        resultCard.setBackgroundResource(R.drawable.bg_operator_result_success);
        resultIcon.setImageResource(R.drawable.ic_check);
        resultIcon.setColorFilter(getColor(R.color.secondary));
        resultTitleText.setText(data.alreadyProcessed
                ? R.string.scan_result_retry_title : R.string.scan_result_verified_title);
        resultChipText.setBackgroundResource(R.drawable.bg_chip_active);
        resultChipText.setTextColor(getColor(R.color.primary_container));
        resultChipText.setText(R.string.scan_verified_chip);
        resultMessageText.setVisibility(View.GONE);
        resultDetails.setVisibility(View.VISIBLE);

        resultReservationCodeText.setText(data.reservationId);
        String prosumer = data.prosumerName == null || data.prosumerName.isEmpty()
                ? data.prosumerNic
                : getString(R.string.station_meta, data.prosumerName, data.prosumerNic);
        resultProsumerText.setText(prosumer);
        resultStationText.setText(data.stationId);
        Date scheduled = TimeUtils.parseApiDate(data.scheduledTime);
        resultScheduledTimeText.setText(scheduled == null
                ? getString(R.string.metric_empty)
                : getString(R.string.detail_datetime_value,
                        TimeUtils.formatShortDate(scheduled), TimeUtils.formatTime(scheduled)));
        resultStatusText.setText(data.status);

        setChip(true);
        scanVerifyingView.setVisibility(View.GONE);
        scanWorkspace.setVisibility(View.GONE);
        resultCard.setVisibility(View.VISIBLE);
    }

    private void showRejectedResult(String message) {
        // A rejected server response keeps its reason prominent in the result card.
        resultCard.setBackgroundResource(R.drawable.bg_operator_result_rejected);
        resultIcon.setImageResource(R.drawable.ic_error);
        resultIcon.setColorFilter(getColor(R.color.alert_danger));
        resultTitleText.setText(R.string.scan_result_rejected_title);
        resultChipText.setBackgroundResource(R.drawable.bg_chip_danger);
        resultChipText.setTextColor(getColor(R.color.alert_danger));
        resultChipText.setText(R.string.scan_rejected_chip);
        resultMessageText.setText(message);
        resultMessageText.setTextColor(getColor(R.color.on_error_container));
        resultMessageText.setVisibility(View.VISIBLE);
        resultDetails.setVisibility(View.GONE);

        setChip(false);
        scanVerifyingView.setVisibility(View.GONE);
        scanWorkspace.setVisibility(View.GONE);
        resultCard.setVisibility(View.VISIBLE);
    }

    private void showUnavailableResult(String message) {
        // A missing API verdict is presented as unavailable, never as a rejected QR.
        resultCard.setBackgroundResource(R.drawable.bg_operator_card);
        resultIcon.setImageResource(R.drawable.ic_error);
        resultIcon.setColorFilter(getColor(R.color.operator_information));
        resultTitleText.setText(R.string.operator_scan_unavailable_title);
        resultChipText.setBackgroundResource(R.drawable.bg_chip_neutral);
        resultChipText.setTextColor(getColor(R.color.on_surface_variant));
        resultChipText.setText(R.string.operator_scan_unavailable_chip);
        resultMessageText.setText(message);
        resultMessageText.setTextColor(getColor(R.color.on_surface_variant));
        resultMessageText.setVisibility(View.VISIBLE);
        resultDetails.setVisibility(View.GONE);

        scanStatusChip.setBackgroundResource(R.drawable.bg_chip_neutral);
        scanStatusChip.setTextColor(getColor(R.color.on_surface_variant));
        scanStatusChip.setText(R.string.operator_scan_unavailable_chip);
        scanVerifyingView.setVisibility(View.GONE);
        scanWorkspace.setVisibility(View.GONE);
        resultCard.setVisibility(View.VISIBLE);
    }

    private void setChip(boolean verified) {
        scanStatusChip.setBackgroundResource(verified ? R.drawable.bg_chip_active : R.drawable.bg_chip_danger);
        scanStatusChip.setTextColor(getColor(verified ? R.color.primary_container : R.color.alert_danger));
        scanStatusChip.setText(verified ? R.string.scan_verified_chip : R.string.scan_rejected_chip);
    }

    private void resumeScanning() {
        showingResult = false;
        resultCard.setVisibility(View.GONE);
        scanVerifyingView.setVisibility(View.GONE);
        scanWorkspace.setVisibility(View.VISIBLE);
        setReadyChip();
        if (cameraPermissionGranted) {
            barcodeScanner.decodeSingle(barcodeCallback);
            barcodeScanner.resume();
        }
    }
}

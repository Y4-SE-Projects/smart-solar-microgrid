// File: RecentScansActivity.java
// Purpose: Grid Operator screen listing the operator's own recent QR scans (success and rejected).

package com.example.smart_solar_mobile.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.adapters.ScanHistoryAdapter;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.QrScanEntryResponse;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.google.android.material.button.MaterialButton;

import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RecentScansActivity extends AppCompatActivity {

    private Call<ApiResponse<List<QrScanEntryResponse>>> scansCall;

    private ScanHistoryAdapter adapter;
    private RecyclerView scansList;
    private android.widget.TextView subtitleText;
    private View scansLoadingView;
    private View scansStateCard;
    private ImageView scansStateIcon;
    private android.widget.TextView scansStateTitle;
    private android.widget.TextView scansStateMessage;
    private MaterialButton retryScansButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recent_scans);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.recentScansRoot));

        subtitleText = findViewById(R.id.recentScansSubtitleText);
        scansList = findViewById(R.id.scansList);
        scansLoadingView = findViewById(R.id.scansLoadingView);
        scansStateCard = findViewById(R.id.scansStateCard);
        scansStateIcon = findViewById(R.id.scansStateIcon);
        scansStateTitle = findViewById(R.id.scansStateTitle);
        scansStateMessage = findViewById(R.id.scansStateMessage);
        retryScansButton = findViewById(R.id.retryScansButton);

        adapter = new ScanHistoryAdapter();
        scansList.setLayoutManager(new LinearLayoutManager(this));
        scansList.setAdapter(adapter);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        retryScansButton.setOnClickListener(v -> loadRecentScans());

        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            if (session == null || !Roles.GRID_OPERATOR.equals(session.role)) {
                Navigator.openLogin(this, false);
                return;
            }
            loadRecentScans();
        });
    }

    @Override
    protected void onDestroy() {
        if (scansCall != null) scansCall.cancel();
        super.onDestroy();
    }

    private void loadRecentScans() {
        if (scansCall != null) scansCall.cancel();

        scansList.setVisibility(View.GONE);
        scansStateCard.setVisibility(View.GONE);
        scansLoadingView.setVisibility(View.VISIBLE);
        subtitleText.setText("");

        scansCall = NetworkManager.getInstance().getApiService().getRecentScans();
        final Call<ApiResponse<List<QrScanEntryResponse>>> call = scansCall;
        call.enqueue(new Callback<ApiResponse<List<QrScanEntryResponse>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<QrScanEntryResponse>>> request,
                                    @NonNull Response<ApiResponse<List<QrScanEntryResponse>>> response) {
                if (isFinishing() || isDestroyed() || call != scansCall || call.isCanceled()) {
                    return;
                }
                scansLoadingView.setVisibility(View.GONE);
                ApiResponse<List<QrScanEntryResponse>> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null) {
                    showState(getString(R.string.recent_scans_error_title),
                            ApiErrorParser.getMessage(RecentScansActivity.this, response), true);
                    return;
                }
                adapter.setScans(body.data);
                subtitleText.setText(getString(R.string.recent_scans_subtitle, body.data.size()));
                if (adapter.isEmpty()) {
                    showState(getString(R.string.recent_scans_empty_title),
                            getString(R.string.recent_scans_empty_body), false);
                } else {
                    scansStateCard.setVisibility(View.GONE);
                    scansList.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<QrScanEntryResponse>>> request,
                                   @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != scansCall || call.isCanceled()) {
                    return;
                }
                scansLoadingView.setVisibility(View.GONE);
                showState(getString(R.string.recent_scans_error_title),
                        getString(R.string.error_network), true);
            }
        });
    }

    private void showState(String title, String message, boolean retry) {
        // The existing retry flag distinguishes a failed request from an empty live result.
        scansStateCard.setBackgroundResource(retry
                ? R.drawable.bg_operator_result_rejected : R.drawable.bg_operator_card);
        scansStateIcon.setImageResource(retry ? R.drawable.ic_error : R.drawable.ic_schedule);
        scansStateIcon.setColorFilter(getColor(retry ? R.color.alert_danger : R.color.secondary));
        scansStateTitle.setText(title);
        scansStateMessage.setText(message);
        retryScansButton.setVisibility(retry ? View.VISIBLE : View.GONE);
        scansStateCard.setVisibility(View.VISIBLE);
        scansList.setVisibility(View.GONE);
    }
}

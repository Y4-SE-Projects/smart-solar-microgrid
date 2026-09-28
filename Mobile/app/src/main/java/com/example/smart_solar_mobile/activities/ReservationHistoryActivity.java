// File: ReservationHistoryActivity.java
// Purpose: Prosumer screen listing every one of their reservations, with a status filter.

package com.example.smart_solar_mobile.activities;

import android.os.Bundle;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.adapters.ReservationAdapter;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.chip.ChipGroup;

import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ReservationHistoryActivity extends AppCompatActivity {

    private String prosumerNic;
    private Call<ApiResponse<List<ReservationData>>> historyCall;

    private ReservationAdapter adapter;
    private ChipGroup statusFilterGroup;
    private RecyclerView historyList;
    private View historyLoadingView;
    private View historyStateCard;
    private android.widget.TextView historyStateTitle;
    private android.widget.TextView historyStateMessage;
    private MaterialButton retryHistoryButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reservation_history);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.historyRoot));

        historyList = findViewById(R.id.historyList);
        historyLoadingView = findViewById(R.id.historyLoadingView);
        historyStateCard = findViewById(R.id.historyStateCard);
        historyStateTitle = findViewById(R.id.historyStateTitle);
        historyStateMessage = findViewById(R.id.historyStateMessage);
        retryHistoryButton = findViewById(R.id.retryHistoryButton);
        statusFilterGroup = findViewById(R.id.statusFilterGroup);

        adapter = new ReservationAdapter(reservation -> ReservationDetailActivity.start(this, reservation));
        historyList.setLayoutManager(new LinearLayoutManager(this));
        historyList.setAdapter(adapter);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        retryHistoryButton.setOnClickListener(v -> loadHistory());
        statusFilterGroup.setOnCheckedStateChangeListener((group, checkedIds) -> applyFilter());

        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || session.identifier == null || session.identifier.trim().isEmpty()) {
                Navigator.openLogin(this, false);
                return;
            }
            prosumerNic = session.identifier;
            loadHistory();
        });
    }

    @Override
    protected void onDestroy() {
        if (historyCall != null) historyCall.cancel();
        super.onDestroy();
    }

    private void loadHistory() {
        if (prosumerNic == null) return;
        if (historyCall != null) historyCall.cancel();

        historyList.setVisibility(View.GONE);
        historyStateCard.setVisibility(View.GONE);
        historyLoadingView.setVisibility(View.VISIBLE);

        historyCall = NetworkManager.getInstance().getApiService()
                .getProsumerReservations(prosumerNic);
        final Call<ApiResponse<List<ReservationData>>> call = historyCall;
        call.enqueue(new Callback<ApiResponse<List<ReservationData>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                    @NonNull Response<ApiResponse<List<ReservationData>>> response) {
                if (isFinishing() || isDestroyed() || call != historyCall || call.isCanceled()) {
                    return;
                }
                historyLoadingView.setVisibility(View.GONE);
                ApiResponse<List<ReservationData>> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null) {
                    showState(getString(R.string.history_error_title),
                            ApiErrorParser.getMessage(ReservationHistoryActivity.this, response), true);
                    return;
                }
                adapter.setReservations(body.data);
                applyFilter();
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                   @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != historyCall || call.isCanceled()) {
                    return;
                }
                historyLoadingView.setVisibility(View.GONE);
                showState(getString(R.string.history_error_title),
                        getString(R.string.error_network), true);
            }
        });
    }

    private void applyFilter() {
        int checkedId = statusFilterGroup.getCheckedChipId();
        adapter.setStatusFilter(statusFor(checkedId));

        if (adapter.isEmpty()) {
            boolean filtered = checkedId != R.id.filterAllChip && adapter.hasAnyReservations();
            showState(
                    getString(filtered ? R.string.history_empty_filtered_title : R.string.history_empty_title),
                    getString(filtered ? R.string.history_empty_filtered_body : R.string.history_empty_body),
                    false);
        } else {
            historyStateCard.setVisibility(View.GONE);
            historyList.setVisibility(View.VISIBLE);
        }
    }

    private String statusFor(int checkedChipId) {
        if (checkedChipId == R.id.filterPendingChip) return "Pending";
        if (checkedChipId == R.id.filterApprovedChip) return "Approved";
        if (checkedChipId == R.id.filterCompletedChip) return "Completed";
        if (checkedChipId == R.id.filterDeclinedChip) return "Declined";
        if (checkedChipId == R.id.filterCancelledChip) return "Cancelled";
        return null;
    }

    private void showState(String title, String message, boolean retry) {
        historyStateTitle.setText(title);
        historyStateMessage.setText(message);
        retryHistoryButton.setVisibility(retry ? View.VISIBLE : View.GONE);
        historyStateCard.setVisibility(View.VISIBLE);
        historyList.setVisibility(View.GONE);
    }
}

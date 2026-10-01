// File: ReservationHistoryActivity.java
// Purpose: Prosumer screen listing every one of their reservations, with a status filter.

package com.example.smart_solar_mobile.activities;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.adapters.ReservationAdapter;
import com.example.smart_solar_mobile.db.AppDatabase;
import com.example.smart_solar_mobile.db.ReservationCacheDao;
import com.example.smart_solar_mobile.db.ReservationCacheEntity;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.ConnectivityRetryObserver;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.views.ProsumerBottomNavigation;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.chip.ChipGroup;

import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ReservationHistoryActivity extends AppCompatActivity {
    // Optional entry selection; regular Bookings launches omit it and keep the XML's All chip.
    public static final String EXTRA_INITIAL_STATUS_FILTER = "reservation_history.initial_status_filter";

    private String prosumerNic;
    private Call<ApiResponse<List<ReservationData>>> historyCall;
    private final ExecutorService cacheExecutor = Executors.newSingleThreadExecutor();
    private ReservationCacheDao reservationCacheDao;
    private ConnectivityRetryObserver connectivityRetryObserver;
    private long generation;
    private long lastSyncedAt;
    private boolean hasDisplayData;
    private boolean freshThisActivation;
    private boolean syncing;
    private String lastSyncError;

    private ReservationAdapter adapter;
    private ChipGroup statusFilterGroup;
    private RecyclerView historyList;
    private View historyLoadingView;
    private View historyStateCard;
    private android.widget.TextView historyStateTitle;
    private android.widget.TextView historyStateMessage;
    private MaterialButton retryHistoryButton;
    private View syncBanner;
    private View syncProgress;
    private TextView syncText;
    private MaterialButton syncRetryButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reservation_history);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.historyRoot));
        ((ProsumerBottomNavigation) findViewById(R.id.prosumerBottomNavigation))
                .setup(this, ProsumerBottomNavigation.Destination.BOOKINGS);
        reservationCacheDao = AppDatabase.getInstance(this).reservationCacheDao();

        historyList = findViewById(R.id.historyList);
        historyLoadingView = findViewById(R.id.historyLoadingView);
        historyStateCard = findViewById(R.id.historyStateCard);
        historyStateTitle = findViewById(R.id.historyStateTitle);
        historyStateMessage = findViewById(R.id.historyStateMessage);
        retryHistoryButton = findViewById(R.id.retryHistoryButton);
        statusFilterGroup = findViewById(R.id.statusFilterGroup);
        syncBanner = findViewById(R.id.historySyncBanner);
        syncProgress = findViewById(R.id.historySyncProgress);
        syncText = findViewById(R.id.historySyncText);
        syncRetryButton = findViewById(R.id.historySyncRetryButton);

        adapter = new ReservationAdapter(reservation -> ReservationDetailActivity.start(this, reservation));
        historyList.setLayoutManager(new LinearLayoutManager(this));
        historyList.setAdapter(adapter);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        retryHistoryButton.setOnClickListener(v -> loadHistory());
        syncRetryButton.setOnClickListener(v -> loadHistory());
        if ("Pending".equalsIgnoreCase(getIntent().getStringExtra(EXTRA_INITIAL_STATUS_FILTER))) {
            statusFilterGroup.check(R.id.filterPendingChip);
        }
        statusFilterGroup.setOnCheckedStateChangeListener((group, checkedIds) -> applyFilter());
        ((EditText) findViewById(R.id.historySearchInput)).addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                adapter.setSearchQuery(s.toString());
                applyFilter();
            }
            @Override public void afterTextChanged(Editable s) { }
        });
        connectivityRetryObserver = new ConnectivityRetryObserver(this,
                () -> { if (lastSyncError != null && !syncing && prosumerNic != null) loadHistory(); },
                () -> { if (hasDisplayData && !syncing) showSyncError(getString(R.string.error_network)); });
    }

    @Override
    protected void onResume() {
        // Resolve identity on every return and clear old account data before loading its cache.
        super.onResume();
        final long currentGeneration = ++generation;
        if (historyCall != null) historyCall.cancel();
        historyCall = null;
        prosumerNic = null;
        hasDisplayData = false;
        freshThisActivation = false;
        syncing = false;
        lastSyncError = null;
        lastSyncedAt = 0;
        adapter.setReservations(new ArrayList<>());
        historyList.setVisibility(View.GONE);
        historyStateCard.setVisibility(View.GONE);
        historyLoadingView.setVisibility(View.VISIBLE);
        syncBanner.setVisibility(View.GONE);
        syncProgress.setVisibility(View.GONE);
        connectivityRetryObserver.start();
        SessionManager.getInstance().loadSession(session -> {
            if (currentGeneration != generation || isFinishing() || isDestroyed()) return;
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || session.identifier == null || session.identifier.trim().isEmpty()) {
                Navigator.openLogin(this, false);
                return;
            }
            prosumerNic = session.identifier;
            loadCachedHistory(prosumerNic, currentGeneration);
            loadHistory();
        });
    }

    @Override
    protected void onStop() {
        connectivityRetryObserver.stop();
        generation++;
        if (historyCall != null) historyCall.cancel();
        historyCall = null;
        prosumerNic = null;
        hasDisplayData = false;
        adapter.setReservations(new ArrayList<>());
        historyList.setVisibility(View.GONE);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (historyCall != null) historyCall.cancel();
        cacheExecutor.shutdown();
        super.onDestroy();
    }

    private void loadCachedHistory(String nic, long currentGeneration) {
        // Room is queried only by the authenticated NIC; late results cannot replace fresh data.
        cacheExecutor.execute(() -> {
            List<ReservationCacheEntity> rows;
            try {
                rows = reservationCacheDao.getForProsumer(nic);
            } catch (RuntimeException ignored) {
                return;
            }
            runOnUiThread(() -> {
                if (currentGeneration != generation || isFinishing() || isDestroyed()
                        || !nic.equals(prosumerNic) || freshThisActivation || rows.isEmpty()) return;
                List<ReservationData> cached = new ArrayList<>();
                for (ReservationCacheEntity row : rows) {
                    if (nic.equals(row.prosumerNic)) cached.add(row.toReservationData());
                }
                if (cached.isEmpty()) return;
                lastSyncedAt = rows.get(0).lastSyncedAt;
                hasDisplayData = true;
                adapter.setReservations(cached);
                applyFilter();
            });
        });
    }

    private void loadHistory() {
        // API refresh begins immediately while cached records remain readable.
        if (prosumerNic == null) return;
        if (historyCall != null) historyCall.cancel();
        final String nic = prosumerNic;
        final long currentGeneration = generation;
        syncing = true;
        lastSyncError = null;
        renderState();
        historyCall = NetworkManager.getInstance().getApiService()
                .getProsumerReservations(nic);
        final Call<ApiResponse<List<ReservationData>>> call = historyCall;
        call.enqueue(new Callback<ApiResponse<List<ReservationData>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                    @NonNull Response<ApiResponse<List<ReservationData>>> response) {
                if (obsolete(call, nic, currentGeneration)) return;
                ApiResponse<List<ReservationData>> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null) {
                    if (response.code() == 401 || response.code() == 403) {
                        // An explicit server denial is not an offline cache fallback.
                        freshThisActivation = true;
                        hasDisplayData = false;
                        adapter.setReservations(new ArrayList<>());
                        historyList.setVisibility(View.GONE);
                    }
                    showSyncError(ApiErrorParser.getMessage(ReservationHistoryActivity.this, response));
                    return;
                }
                syncing = false;
                freshThisActivation = true;
                hasDisplayData = true;
                lastSyncError = null;
                lastSyncedAt = System.currentTimeMillis();
                adapter.setReservations(body.data);
                applyFilter();
                final long syncedAt = lastSyncedAt;
                cacheExecutor.execute(() -> {
                    try {
                        reservationCacheDao.replaceForProsumer(nic, body.data, syncedAt);
                    } catch (RuntimeException ignored) {
                        // A local cache failure cannot invalidate the live API response.
                    }
                });
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                   @NonNull Throwable error) {
                if (!obsolete(call, nic, currentGeneration)) {
                    showSyncError(getString(R.string.error_network));
                }
            }
        });
    }

    private boolean obsolete(Call<?> call, String nic, long currentGeneration) {
        return isFinishing() || isDestroyed() || call != historyCall || call.isCanceled()
                || currentGeneration != generation || !nic.equals(prosumerNic);
    }

    private void showSyncError(String message) {
        // Connectivity alone never makes cached data authoritative.
        syncing = false;
        lastSyncError = message;
        renderState();
    }

    private void applyFilter() {
        int checkedId = statusFilterGroup.getCheckedChipId();
        String selectedStatus = statusFor(checkedId);
        adapter.setStatusFilter(selectedStatus);
        renderState();
    }

    private void renderState() {
        syncProgress.setVisibility(syncing ? View.VISIBLE : View.GONE);
        if (!hasDisplayData) {
            syncBanner.setVisibility(View.GONE);
            historyLoadingView.setVisibility(syncing || prosumerNic == null ? View.VISIBLE : View.GONE);
            if (syncing) historyStateCard.setVisibility(View.GONE);
            if (lastSyncError != null) {
                showState(getString(R.string.history_error_title), lastSyncError, true);
            }
            return;
        }
        historyLoadingView.setVisibility(View.GONE);
        if (adapter.isEmpty()) {
            boolean filtered = statusFor(statusFilterGroup.getCheckedChipId()) != null
                    || !((EditText) findViewById(R.id.historySearchInput))
                    .getText().toString().trim().isEmpty();
            showState(
                    getString(filtered ? R.string.history_empty_filtered_title : R.string.history_empty_title),
                    getString(filtered ? R.string.history_empty_filtered_body : R.string.history_empty_body),
                    false);
        } else {
            historyStateCard.setVisibility(View.GONE);
            historyList.setVisibility(View.VISIBLE);
        }
        syncBanner.setVisibility(syncing || lastSyncError != null ? View.VISIBLE : View.GONE);
        syncRetryButton.setVisibility(lastSyncError != null ? View.VISIBLE : View.GONE);
        if (syncing) {
            syncText.setText(R.string.history_syncing);
        } else if (lastSyncError != null) {
            syncText.setText(lastSyncedAt > 0
                    ? getString(R.string.history_stale, DateFormat.getDateTimeInstance(
                    DateFormat.MEDIUM, DateFormat.SHORT).format(new Date(lastSyncedAt)))
                    : getString(R.string.history_stale_no_time));
        }
    }

    private String statusFor(int checkedChipId) {
        if (checkedChipId == R.id.filterPendingChip) return "Pending";
        if (checkedChipId == R.id.filterApprovedChip) return "Approved";
        if (checkedChipId == R.id.filterCompletedChip) return "Completed";
        if (checkedChipId == R.id.filterDeclinedChip) return "Declined";
        if (checkedChipId == R.id.filterCancelledChip) return "Cancelled";
        if (checkedChipId == R.id.filterExpiredChip) return "Expired";
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

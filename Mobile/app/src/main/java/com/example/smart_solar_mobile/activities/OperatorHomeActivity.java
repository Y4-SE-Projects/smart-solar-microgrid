// File: OperatorHomeActivity.java
// Purpose: Grid Operator console: pick a station, then see its details and today's slots from the API.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat.AccessibilityActionCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionEntity;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.EnergyBookingSlot;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.models.SolarStation;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.button.MaterialButton;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OperatorHomeActivity extends AppCompatActivity {
    private static final String STATE_SELECTED_STATION_ID = "selected_station_id";
    private static final DecimalFormat CAPACITY_FORMAT = new DecimalFormat("0.##");

    private final List<SolarStation> stations = new ArrayList<>();
    private SolarStation selectedStation;
    // Station to reselect after the screen is recreated, e.g. on rotation
    private String restoredStationId;
    private Call<ApiResponse<List<SolarStation>>> stationsCall;
    private Call<ApiResponse<List<EnergyBookingSlot>>> slotsCall;
    // Opens Manage Slots and hears back which station the operator ended up on there
    private final ActivityResultLauncher<Intent> manageSlotsLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), this::onManageSlotsClosed);

    private TextView headerStationText;
    private TextView operatorInitialsText;
    private TextView operatorNameText;
    private TextView operatorRoleText;
    private View stationSwitcher;
    private View stationsErrorBanner;
    private TextView stationsErrorText;
    private View stationContent;
    private TextView deactivatedNotice;
    private TextView stationNameText;
    private TextView stationStatusChip;
    private TextView stationHoursText;
    private TextView stationCapacityText;
    private TextView stationBatteryText;
    private TextView todayDateText;
    private TextView metricTotalText;
    private TextView metricAvailableText;
    private TextView metricUnavailableText;
    private MaterialButton refreshSlotsButton;
    private View slotsProgress;
    private View slotsErrorBanner;
    private TextView slotsErrorText;
    private TextView slotsEmptyText;
    private LinearLayout todaySlotsContainer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds the console, checks the session, then loads the station list
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_operator_home);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.homeRoot));
        bindViews();

        findViewById(R.id.signOutButton).setOnClickListener(v ->
                SessionManager.getInstance().endSession(() -> Navigator.openLogin(this, false)));
        stationSwitcher.setOnClickListener(v -> openStationPicker());
        // Screen readers announce the header tap as "change station"
        ViewCompat.replaceAccessibilityAction(stationSwitcher, AccessibilityActionCompat.ACTION_CLICK,
                getString(R.string.change_station), null);
        findViewById(R.id.stationsRetryButton).setOnClickListener(v -> loadStations());
        findViewById(R.id.slotsRetryButton).setOnClickListener(v -> loadTodaySlots());
        refreshSlotsButton.setOnClickListener(v -> loadTodaySlots());
        findViewById(R.id.manageSlotsButton).setOnClickListener(v -> openManageSlots());

        if (savedInstanceState != null) {
            restoredStationId = savedInstanceState.getString(STATE_SELECTED_STATION_ID);
        }

        // Loads the session here too, because Android can reopen the app straight onto this screen
        SessionManager.getInstance().loadSession(session -> {
            if (session == null || !Roles.GRID_OPERATOR.equals(session.role)) {
                Navigator.openLogin(this, false);
                return;
            }
            showOperator(session);
            loadStations();
        });
    }

    @Override
    protected void onRestart() {
        // Refreshes today's slots when coming back from another screen, e.g. slot management
        super.onRestart();
        if (selectedStation != null) {
            loadTodaySlots();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Remembers the selected station across rotation
        super.onSaveInstanceState(outState);
        if (selectedStation != null) {
            outState.putString(STATE_SELECTED_STATION_ID, selectedStation.stationId);
        }
    }

    @Override
    protected void onDestroy() {
        // Stops any request still in flight so its reply doesn't touch a destroyed screen
        if (stationsCall != null) {
            stationsCall.cancel();
        }
        if (slotsCall != null) {
            slotsCall.cancel();
        }
        super.onDestroy();
    }

    private void bindViews() {
        // Looks up every view the screen updates
        headerStationText = findViewById(R.id.headerStationText);
        operatorInitialsText = findViewById(R.id.operatorInitialsText);
        operatorNameText = findViewById(R.id.operatorNameText);
        operatorRoleText = findViewById(R.id.operatorRoleText);
        stationSwitcher = findViewById(R.id.stationSwitcher);
        stationsErrorBanner = findViewById(R.id.stationsErrorBanner);
        stationsErrorText = findViewById(R.id.stationsErrorText);
        stationContent = findViewById(R.id.stationContent);
        deactivatedNotice = findViewById(R.id.deactivatedNotice);
        stationNameText = findViewById(R.id.stationNameText);
        stationStatusChip = findViewById(R.id.stationStatusChip);
        stationHoursText = findViewById(R.id.stationHoursText);
        stationCapacityText = findViewById(R.id.stationCapacityText);
        stationBatteryText = findViewById(R.id.stationBatteryText);
        todayDateText = findViewById(R.id.todayDateText);
        metricTotalText = findViewById(R.id.metricTotalText);
        metricAvailableText = findViewById(R.id.metricAvailableText);
        metricUnavailableText = findViewById(R.id.metricUnavailableText);
        refreshSlotsButton = findViewById(R.id.refreshSlotsButton);
        slotsProgress = findViewById(R.id.slotsProgress);
        slotsErrorBanner = findViewById(R.id.slotsErrorBanner);
        slotsErrorText = findViewById(R.id.slotsErrorText);
        slotsEmptyText = findViewById(R.id.slotsEmptyText);
        todaySlotsContainer = findViewById(R.id.todaySlotsContainer);
    }

    private void showOperator(SessionEntity session) {
        // Fills the operator card from the saved session
        String name = session.fullName == null || session.fullName.isEmpty() ? session.identifier : session.fullName;
        operatorNameText.setText(name);
        operatorInitialsText.setText(initialsOf(name));
    }

    private void loadStations() {
        // Fetches every station (active and deactivated), matching the web slot page
        stationsErrorBanner.setVisibility(View.GONE);
        setHeaderStation(getString(R.string.station_loading), false);

        if (stationsCall != null) {
            stationsCall.cancel();
        }
        stationsCall = NetworkManager.getInstance().getApiService().getStations();
        stationsCall.enqueue(new Callback<ApiResponse<List<SolarStation>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<SolarStation>>> call,
                                   @NonNull Response<ApiResponse<List<SolarStation>>> response) {
                // Shows the list, or the API's reason for failing
                if (isFinishing() || isDestroyed() || call.isCanceled()) {
                    return;
                }
                ApiResponse<List<SolarStation>> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    onStationsLoaded(body.data);
                } else {
                    showStationsError(ApiErrorParser.getMessage(OperatorHomeActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<SolarStation>>> call, @NonNull Throwable t) {
                // The request never reached the API
                if (isFinishing() || isDestroyed() || call.isCanceled()) {
                    return;
                }
                showStationsError(getString(R.string.error_network));
            }
        });
    }

    private void onStationsLoaded(List<SolarStation> loaded) {
        // Keeps the current or restored station if it still exists, otherwise starts on the first one like the web app
        stations.clear();
        stations.addAll(loaded);

        if (stations.isEmpty()) {
            selectedStation = null;
            setHeaderStation(getString(R.string.station_none), false);
            stationContent.setVisibility(View.GONE);
            return;
        }

        String wantedId = selectedStation != null ? selectedStation.stationId : restoredStationId;
        SolarStation choice = stations.get(0);
        for (SolarStation station : stations) {
            if (station.stationId.equals(wantedId)) {
                choice = station;
                break;
            }
        }
        restoredStationId = null;
        selectStation(choice);
    }

    private void showStationsError(String message) {
        // Shows why the station list couldn't load, with a Retry button
        stationsErrorText.setText(message);
        stationsErrorBanner.setVisibility(View.VISIBLE);
        if (selectedStation != null) {
            setHeaderStation(headerTextFor(selectedStation), true);
        } else {
            setHeaderStation(getString(R.string.station_unavailable), false);
        }
    }

    private void setHeaderStation(String text, boolean canSwitch) {
        // Sets the line under the title; the chevron and tap-to-switch only appear when there are stations to pick from
        headerStationText.setText(text);
        headerStationText.setCompoundDrawablesRelativeWithIntrinsicBounds(0, 0, canSwitch ? R.drawable.ic_expand_more : 0, 0);
        stationSwitcher.setEnabled(canSwitch);
    }

    private String headerTextFor(SolarStation station) {
        // Header line for a station, e.g. "STN-001 • Colombo North"
        return getString(R.string.operator_header_station, station.stationId, station.name);
    }

    private void openStationPicker() {
        // Opens the searchable picker over the stations already loaded from the API
        if (stations.isEmpty()) {
            return;
        }
        String selectedId = selectedStation == null ? null : selectedStation.stationId;
        StationPickerDialog.show(this, stations, selectedId, this::selectStation);
    }

    private void openManageSlots() {
        // Opens slot management for the selected station
        if (selectedStation != null) {
            manageSlotsLauncher.launch(ManageSlotsActivity.intentFor(this, selectedStation));
        }
    }

    private void onManageSlotsClosed(ActivityResult result) {
        // Follows the station the operator switched to on Manage Slots (onRestart already refreshed the same station)
        Intent data = result.getData();
        if (result.getResultCode() != RESULT_OK || data == null) {
            return;
        }
        String stationId = data.getStringExtra(ManageSlotsActivity.RESULT_STATION_ID);
        if (stationId == null || (selectedStation != null && stationId.equals(selectedStation.stationId))) {
            return;
        }
        for (SolarStation station : stations) {
            if (station.stationId.equals(stationId)) {
                selectStation(station);
                return;
            }
        }
    }

    private void selectStation(SolarStation station) {
        // Points the whole screen at the chosen station, then loads its slots
        selectedStation = station;
        String status = getString(station.isActive ? R.string.station_status_active : R.string.station_status_deactivated);

        setHeaderStation(headerTextFor(station), true);
        operatorRoleText.setText(getString(R.string.operator_role_at_station, station.name));

        stationNameText.setText(station.name);
        stationStatusChip.setText(status);
        stationStatusChip.setBackgroundResource(station.isActive ? R.drawable.bg_chip_active : R.drawable.bg_chip_danger);
        stationStatusChip.setTextColor(ContextCompat.getColor(this,
                station.isActive ? R.color.primary_container : R.color.alert_danger));
        stationHoursText.setText(station.schedule);
        stationCapacityText.setText(getString(R.string.station_capacity_value, CAPACITY_FORMAT.format(station.capacityKWh)));
        stationBatteryText.setText(String.valueOf(station.batterySlotCount));

        deactivatedNotice.setText(getString(R.string.station_deactivated_notice, station.stationId));
        deactivatedNotice.setVisibility(station.isActive ? View.GONE : View.VISIBLE);
        stationContent.setVisibility(View.VISIBLE);

        clearTodaySlots();
        loadTodaySlots();
    }

    private void loadTodaySlots() {
        // Fetches this month's slots for the selected station via GET /api/stations/{stationId}/slots
        if (selectedStation == null) {
            return;
        }
        if (slotsCall != null) {
            slotsCall.cancel();
        }

        String stationId = selectedStation.stationId;
        Date now = new Date();
        todayDateText.setText(TimeUtils.formatShortDate(now));
        slotsProgress.setVisibility(View.VISIBLE);
        slotsErrorBanner.setVisibility(View.GONE);
        refreshSlotsButton.setEnabled(false);

        slotsCall = NetworkManager.getInstance().getApiService().getStationSlots(stationId, TimeUtils.monthKey(now));
        slotsCall.enqueue(new Callback<ApiResponse<List<EnergyBookingSlot>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> call,
                                   @NonNull Response<ApiResponse<List<EnergyBookingSlot>>> response) {
                // Shows today's slots, ignoring a late reply for a station the operator has moved away from
                if (isFinishing() || isDestroyed() || call.isCanceled()
                        || selectedStation == null || !stationId.equals(selectedStation.stationId)) {
                    return;
                }
                slotsProgress.setVisibility(View.GONE);
                refreshSlotsButton.setEnabled(true);
                ApiResponse<List<EnergyBookingSlot>> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    showTodaySlots(body.data, now);
                } else {
                    showSlotsError(ApiErrorParser.getMessage(OperatorHomeActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> call, @NonNull Throwable t) {
                // The request never reached the API
                if (isFinishing() || isDestroyed() || call.isCanceled()) {
                    return;
                }
                slotsProgress.setVisibility(View.GONE);
                refreshSlotsButton.setEnabled(true);
                showSlotsError(getString(R.string.error_network));
            }
        });
    }

    private void clearTodaySlots() {
        // Empties the counts and list so the previous station's slots never show under a new station
        metricTotalText.setText(R.string.metric_empty);
        metricAvailableText.setText(R.string.metric_empty);
        metricUnavailableText.setText(R.string.metric_empty);
        todaySlotsContainer.removeAllViews();
        todaySlotsContainer.setVisibility(View.GONE);
        slotsEmptyText.setVisibility(View.GONE);
        slotsErrorBanner.setVisibility(View.GONE);
    }

    private void showTodaySlots(List<EnergyBookingSlot> monthSlots, Date now) {
        // Keeps only today's slots (the month reply includes a padding day each side), then fills the counts and list
        List<EnergyBookingSlot> todaySlots = new ArrayList<>();
        int availableCount = 0;
        for (EnergyBookingSlot slot : monthSlots) {
            Date start = TimeUtils.parseApiDate(slot.startTime);
            if (start != null && TimeUtils.isSameLocalDay(start, now)) {
                todaySlots.add(slot);
                if (slot.isAvailable) {
                    availableCount++;
                }
            }
        }

        metricTotalText.setText(String.valueOf(todaySlots.size()));
        metricAvailableText.setText(String.valueOf(availableCount));
        metricUnavailableText.setText(String.valueOf(todaySlots.size() - availableCount));

        todaySlotsContainer.removeAllViews();
        LayoutInflater inflater = getLayoutInflater();
        for (EnergyBookingSlot slot : todaySlots) {
            todaySlotsContainer.addView(buildSlotRow(inflater, slot, now));
        }
        todaySlotsContainer.setVisibility(todaySlots.isEmpty() ? View.GONE : View.VISIBLE);
        slotsEmptyText.setVisibility(todaySlots.isEmpty() ? View.VISIBLE : View.GONE);
    }

    private View buildSlotRow(LayoutInflater inflater, EnergyBookingSlot slot, Date now) {
        // Builds one row showing the slot's local time window, length and availability
        View row = inflater.inflate(R.layout.item_today_slot, todaySlotsContainer, false);
        TextView timeText = row.findViewById(R.id.slotTimeText);
        TextView durationText = row.findViewById(R.id.slotDurationText);
        TextView statusChip = row.findViewById(R.id.slotStatusChip);

        Date start = TimeUtils.parseApiDate(slot.startTime);
        Date end = TimeUtils.parseApiDate(slot.endTime);
        if (start != null && end != null) {
            timeText.setText(getString(R.string.slot_time_range, TimeUtils.formatTime(start), TimeUtils.formatTime(end)));
            durationText.setText(TimeUtils.formatDuration(this, (end.getTime() - start.getTime()) / 60000));
            // Slots that have already finished are dimmed
            if (end.before(now)) {
                row.setAlpha(0.55f);
            }
        } else {
            timeText.setText(slot.slotId);
            durationText.setVisibility(View.GONE);
        }

        statusChip.setText(slot.isAvailable ? R.string.slot_available : R.string.slot_unavailable);
        statusChip.setBackgroundResource(slot.isAvailable ? R.drawable.bg_chip_active : R.drawable.bg_chip_neutral);
        statusChip.setTextColor(ContextCompat.getColor(this,
                slot.isAvailable ? R.color.primary_container : R.color.on_surface_variant));
        return row;
    }

    private void showSlotsError(String message) {
        // Shows why the slots couldn't load, with a Retry button
        slotsErrorText.setText(message);
        slotsErrorBanner.setVisibility(View.VISIBLE);
    }

    private static String initialsOf(String name) {
        // Up to two initials from the operator's name, e.g. "Dinesh Samarasinghe" -> "DS"
        StringBuilder initials = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            if (!part.isEmpty() && initials.length() < 2) {
                initials.append(Character.toUpperCase(part.charAt(0)));
            }
        }
        return initials.toString();
    }
}

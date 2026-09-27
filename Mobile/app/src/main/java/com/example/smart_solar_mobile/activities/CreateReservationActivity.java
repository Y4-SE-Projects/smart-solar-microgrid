// File: CreateReservationActivity.java
// Purpose: Prosumer creation of a reservation using live stations, slots, and the API.

package com.example.smart_solar_mobile.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.core.widget.NestedScrollView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.adapters.ReservationSlotAdapter;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.CreateReservationRequest;
import com.example.smart_solar_mobile.models.EnergyBookingSlot;
import com.example.smart_solar_mobile.models.ReservationData;
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

public class CreateReservationActivity extends AppCompatActivity {
    private static final String STATE_STATION_ID = "selected_station_id";
    private static final String STATE_SLOT_ID = "selected_slot_id";
    private static final String STATE_CREATED_ID = "created_reservation_id";
    private static final String STATE_CREATED_STATUS = "created_reservation_status";

    private final List<SolarStation> activeStations = new ArrayList<>();
    private final DecimalFormat capacityFormat = new DecimalFormat("0.##");

    private SolarStation selectedStation;
    private EnergyBookingSlot selectedSlot;
    private ReservationData createdReservation;
    private String restoredStationId;
    private String restoredSlotId;

    private Call<ApiResponse<List<SolarStation>>> stationsCall;
    private Call<ApiResponse<List<EnergyBookingSlot>>> slotsCall;
    private Call<ApiResponse<ReservationData>> createCall;

    private boolean stationsLoading;
    private boolean slotsLoading;
    private boolean submitting;

    private ReservationSlotAdapter slotAdapter;
    private NestedScrollView reservationScroll;
    private RecyclerView slotsList;

    private TextView bookingNicText;
    private TextView stationNameText;
    private TextView stationIdText;
    private TextView stationScheduleText;
    private TextView stationCapacityText;
    private TextView stationStateTitle;
    private TextView stationStateMessage;
    private TextView slotsStateTitle;
    private TextView slotsStateMessage;
    private TextView availableCountText;
    private TextView summaryStationText;
    private TextView summaryDateText;
    private TextView summaryTimeText;
    private TextView summarySlotText;
    private TextView createErrorText;
    private TextView createdMessageText;
    private TextView createdIdText;
    private TextView createdStatusText;

    private View stationLoadingView;
    private View stationStateCard;
    private View slotsPromptCard;
    private View slotsLoadingView;
    private View slotsStateCard;
    private View selectedSummaryCard;
    private View createErrorBanner;
    private View createdCard;
    private View bottomActionBar;
    private View submitProgress;

    private MaterialButton stationButton;
    private MaterialButton retryStationsButton;
    private MaterialButton refreshSlotsButton;
    private MaterialButton retrySlotsButton;
    private MaterialButton createButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds the booking screen, restores selection, and checks the Prosumer session.
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_reservation);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.createReservationRoot));
        bindViews();

        slotAdapter = new ReservationSlotAdapter(this::onSlotSelected);
        slotsList.setLayoutManager(new LinearLayoutManager(this));
        slotsList.setNestedScrollingEnabled(false);
        slotsList.setAdapter(slotAdapter);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        stationButton.setOnClickListener(v -> openStationPicker());
        retryStationsButton.setOnClickListener(v -> loadStations());
        refreshSlotsButton.setOnClickListener(v ->
                loadSlots(selectedSlot == null ? null : selectedSlot.slotId));
        retrySlotsButton.setOnClickListener(v -> loadSlots(null));
        createButton.setOnClickListener(v -> createReservation());
        findViewById(R.id.doneButton).setOnClickListener(v -> finish());

        if (savedInstanceState != null) {
            restoredStationId = savedInstanceState.getString(STATE_STATION_ID);
            restoredSlotId = savedInstanceState.getString(STATE_SLOT_ID);
            String createdId = savedInstanceState.getString(STATE_CREATED_ID);
            if (createdId != null) {
                createdReservation = new ReservationData();
                createdReservation.reservationId = createdId;
                createdReservation.status =
                        savedInstanceState.getString(STATE_CREATED_STATUS);
                showCreatedResult(getString(R.string.reservation_created_message));
            }
        }

        renderStation();
        showSlotsPrompt();
        updateActions();

        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || session.identifier == null || session.identifier.trim().isEmpty()) {
                Navigator.openLogin(this, false);
                return;
            }
            bookingNicText.setText(session.identifier);
            loadStations();
        });
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Retains the selection and confirmed result across screen recreation.
        super.onSaveInstanceState(outState);
        outState.putString(STATE_STATION_ID,
                selectedStation == null ? restoredStationId : selectedStation.stationId);
        outState.putString(STATE_SLOT_ID,
                selectedSlot == null ? restoredSlotId : selectedSlot.slotId);
        if (createdReservation != null) {
            outState.putString(STATE_CREATED_ID, createdReservation.reservationId);
            outState.putString(STATE_CREATED_STATUS, createdReservation.status);
        }
    }

    @Override
    protected void onDestroy() {
        // Stops callbacks from writing into a destroyed screen.
        if (stationsCall != null) stationsCall.cancel();
        if (slotsCall != null) slotsCall.cancel();
        if (createCall != null) createCall.cancel();
        super.onDestroy();
    }

    private void bindViews() {
        // Finds the existing XML views once.
        reservationScroll = findViewById(R.id.reservationScroll);
        slotsList = findViewById(R.id.slotsList);
        bookingNicText = findViewById(R.id.bookingNicText);
        stationNameText = findViewById(R.id.stationNameText);
        stationIdText = findViewById(R.id.stationIdText);
        stationScheduleText = findViewById(R.id.stationScheduleText);
        stationCapacityText = findViewById(R.id.stationCapacityText);
        stationStateTitle = findViewById(R.id.stationStateTitle);
        stationStateMessage = findViewById(R.id.stationStateMessage);
        slotsStateTitle = findViewById(R.id.slotsStateTitle);
        slotsStateMessage = findViewById(R.id.slotsStateMessage);
        availableCountText = findViewById(R.id.availableCountText);
        summaryStationText = findViewById(R.id.summaryStationText);
        summaryDateText = findViewById(R.id.summaryDateText);
        summaryTimeText = findViewById(R.id.summaryTimeText);
        summarySlotText = findViewById(R.id.summarySlotText);
        createErrorText = findViewById(R.id.createErrorText);
        createdMessageText = findViewById(R.id.createdMessageText);
        createdIdText = findViewById(R.id.createdIdText);
        createdStatusText = findViewById(R.id.createdStatusText);

        stationLoadingView = findViewById(R.id.stationLoadingView);
        stationStateCard = findViewById(R.id.stationStateCard);
        slotsPromptCard = findViewById(R.id.slotsPromptCard);
        slotsLoadingView = findViewById(R.id.slotsLoadingView);
        slotsStateCard = findViewById(R.id.slotsStateCard);
        selectedSummaryCard = findViewById(R.id.selectedSummaryCard);
        createErrorBanner = findViewById(R.id.createErrorBanner);
        createdCard = findViewById(R.id.createdCard);
        bottomActionBar = findViewById(R.id.bottomActionBar);
        submitProgress = findViewById(R.id.submitProgress);

        stationButton = findViewById(R.id.stationButton);
        retryStationsButton = findViewById(R.id.retryStationsButton);
        refreshSlotsButton = findViewById(R.id.refreshSlotsButton);
        retrySlotsButton = findViewById(R.id.retrySlotsButton);
        createButton = findViewById(R.id.createButton);
    }

    private void loadStations() {
        // Loads live stations; the picker receives only active records.
        if (stationsCall != null) stationsCall.cancel();
        stationsLoading = true;
        stationLoadingView.setVisibility(View.VISIBLE);
        stationStateCard.setVisibility(View.GONE);
        updateActions();

        stationsCall = NetworkManager.getInstance().getApiService().getStations();
        final Call<ApiResponse<List<SolarStation>>> call = stationsCall;
        call.enqueue(new Callback<ApiResponse<List<SolarStation>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<SolarStation>>> request,
                                   @NonNull Response<ApiResponse<List<SolarStation>>> response) {
                // Uses only the latest station reply for this screen.
                if (isFinishing() || isDestroyed() || call != stationsCall || call.isCanceled()) {
                    return;
                }
                stationsLoading = false;
                stationLoadingView.setVisibility(View.GONE);
                ApiResponse<List<SolarStation>> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null) {
                    showStationState(R.string.reservation_stations_error_title,
                            ApiErrorParser.getMessage(CreateReservationActivity.this, response));
                    updateActions();
                    return;
                }

                activeStations.clear();
                for (SolarStation station : body.data) {
                    if (station != null && station.isActive
                            && station.stationId != null
                            && !station.stationId.trim().isEmpty()) {
                        activeStations.add(station);
                    }
                }

                if (activeStations.isEmpty()) {
                    selectedStation = null;
                    selectedSlot = null;
                    renderStation();
                    showSlotsPrompt();
                    showStationState(R.string.reservation_no_stations_title,
                            getString(R.string.reservation_no_stations_body));
                } else {
                    stationStateCard.setVisibility(View.GONE);
                    SolarStation restored = findStation(restoredStationId);
                    restoredStationId = null;
                    if (restored != null) {
                        selectStation(restored, restoredSlotId);
                        restoredSlotId = null;
                    } else {
                        renderStation();
                    }
                }
                updateActions();
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<SolarStation>>> request,
                                  @NonNull Throwable error) {
                // Keeps a visible retry state for network failures.
                if (isFinishing() || isDestroyed() || call != stationsCall || call.isCanceled()) {
                    return;
                }
                stationsLoading = false;
                stationLoadingView.setVisibility(View.GONE);
                showStationState(R.string.reservation_stations_error_title,
                        getString(R.string.error_network));
                updateActions();
            }
        });
    }

    private SolarStation findStation(String stationId) {
        // Finds a previously selected station only among currently active stations.
        if (stationId == null) return null;
        for (SolarStation station : activeStations) {
            if (stationId.equals(station.stationId)) return station;
        }
        return null;
    }

    private void showStationState(int title, String message) {
        // Presents an empty or failed station load with a Retry action.
        stationStateTitle.setText(title);
        stationStateMessage.setText(message);
        stationStateCard.setVisibility(View.VISIBLE);
    }

    private void openStationPicker() {
        // Opens Member 02's searchable picker with active stations only.
        if (submitting || createdReservation != null || activeStations.isEmpty()) return;
        StationPickerDialog.show(this, activeStations,
                selectedStation == null ? null : selectedStation.stationId,
                station -> {
                    if (!submitting && createdReservation == null && station.isActive) {
                        selectStation(station, null);
                    }
                });
    }

    private void selectStation(SolarStation station, String slotIdToRestore) {
        // Changes station, clears the previous slot, and loads this station's live slots.
        if (station == null || !station.isActive) return;
        if (selectedStation != null
                && station.stationId.equals(selectedStation.stationId)
                && slotIdToRestore == null) {
            return;
        }
        selectedStation = station;
        selectedSlot = null;
        renderStation();
        hideCreateError();
        renderSummary();
        loadSlots(slotIdToRestore);
    }

    private void renderStation() {
        // Shows real station fields, or a neutral invitation before selection.
        if (selectedStation == null) {
            stationNameText.setText(R.string.reservation_choose_station);
            stationIdText.setText(R.string.reservation_station_hint);
            stationScheduleText.setVisibility(View.GONE);
            stationCapacityText.setVisibility(View.GONE);
            stationButton.setText(R.string.reservation_choose_station);
            return;
        }
        stationNameText.setText(selectedStation.name == null
                ? selectedStation.stationId : selectedStation.name);
        stationIdText.setText(selectedStation.stationId);
        stationButton.setText(R.string.reservation_change_station);

        boolean hasSchedule = selectedStation.schedule != null
                && !selectedStation.schedule.trim().isEmpty();
        stationScheduleText.setVisibility(hasSchedule ? View.VISIBLE : View.GONE);
        if (hasSchedule) {
            stationScheduleText.setText(getString(
                    R.string.reservation_station_hours, selectedStation.schedule));
        }

        boolean hasCapacity = selectedStation.capacityKWh > 0;
        stationCapacityText.setVisibility(hasCapacity ? View.VISIBLE : View.GONE);
        if (hasCapacity) {
            stationCapacityText.setText(getString(R.string.reservation_station_capacity,
                    capacityFormat.format(selectedStation.capacityKWh)));
        }
    }

    private void showSlotsPrompt() {
        // Asks for a station before any slot request has been made.
        slotsPromptCard.setVisibility(View.VISIBLE);
        slotsLoadingView.setVisibility(View.GONE);
        slotsStateCard.setVisibility(View.GONE);
        slotsList.setVisibility(View.GONE);
        availableCountText.setVisibility(View.GONE);
        selectedSummaryCard.setVisibility(View.GONE);
        updateActions();
    }

    private void loadSlots(String slotIdToKeep) {
        // Loads all months for the selected station so a valid week boundary is not lost.
        if (selectedStation == null) return;
        if (slotsCall != null) slotsCall.cancel();

        String stationId = selectedStation.stationId;
        selectedSlot = null;
        slotAdapter.setSlots(new ArrayList<>(), null);
        slotsLoading = true;
        slotsPromptCard.setVisibility(View.GONE);
        slotsLoadingView.setVisibility(View.VISIBLE);
        slotsStateCard.setVisibility(View.GONE);
        slotsList.setVisibility(View.GONE);
        availableCountText.setVisibility(View.GONE);
        renderSummary();
        updateActions();

        slotsCall = NetworkManager.getInstance().getApiService()
                .getStationSlots(stationId, null);
        final Call<ApiResponse<List<EnergyBookingSlot>>> call = slotsCall;
        call.enqueue(new Callback<ApiResponse<List<EnergyBookingSlot>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> request,
                                   @NonNull Response<ApiResponse<List<EnergyBookingSlot>>> response) {
                // Ignores late replies after a station change.
                if (isFinishing() || isDestroyed() || call != slotsCall || call.isCanceled()
                        || selectedStation == null
                        || !stationId.equals(selectedStation.stationId)) {
                    return;
                }
                slotsLoading = false;
                slotsLoadingView.setVisibility(View.GONE);
                ApiResponse<List<EnergyBookingSlot>> body = response.body();
                if (!response.isSuccessful() || body == null || body.data == null) {
                    showSlotsState(R.string.reservation_slots_error_title,
                            ApiErrorParser.getMessage(CreateReservationActivity.this, response),
                            true);
                    updateActions();
                    return;
                }

                List<EnergyBookingSlot> available = new ArrayList<>();
                for (EnergyBookingSlot slot : body.data) {
                    if (slot != null && slot.isAvailable
                            && stationId.equals(slot.stationId)
                            && slot.slotId != null && !slot.slotId.trim().isEmpty()
                            && TimeUtils.parseApiDate(slot.startTime) != null
                            && TimeUtils.parseApiDate(slot.endTime) != null) {
                        available.add(slot);
                    }
                }

                slotAdapter.setSlots(available, slotIdToKeep);
                selectedSlot = null;
                if (slotIdToKeep != null) {
                    for (EnergyBookingSlot slot : available) {
                        if (slotIdToKeep.equals(slot.slotId)) {
                            selectedSlot = slot;
                            break;
                        }
                    }
                }

                availableCountText.setText(getResources().getQuantityString(
                        R.plurals.reservation_available_count,
                        available.size(), available.size()));
                availableCountText.setVisibility(View.VISIBLE);
                if (available.isEmpty()) {
                    showSlotsState(R.string.reservation_no_slots_title,
                            getString(R.string.reservation_no_slots_body), false);
                } else {
                    slotsStateCard.setVisibility(View.GONE);
                    slotsList.setVisibility(View.VISIBLE);
                }
                renderSummary();
                updateActions();
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> request,
                                  @NonNull Throwable error) {
                // Leaves station selection usable when only its slot request fails.
                if (isFinishing() || isDestroyed() || call != slotsCall || call.isCanceled()
                        || selectedStation == null
                        || !stationId.equals(selectedStation.stationId)) {
                    return;
                }
                slotsLoading = false;
                slotsLoadingView.setVisibility(View.GONE);
                showSlotsState(R.string.reservation_slots_error_title,
                        getString(R.string.error_network), true);
                updateActions();
            }
        });
    }

    private void showSlotsState(int title, String message, boolean retry) {
        // Gives empty and failed slot lists distinct, readable states.
        slotsStateTitle.setText(title);
        slotsStateMessage.setText(message);
        retrySlotsButton.setVisibility(retry ? View.VISIBLE : View.GONE);
        slotsStateCard.setVisibility(View.VISIBLE);
        slotsList.setVisibility(View.GONE);
    }

    private void onSlotSelected(EnergyBookingSlot slot) {
        // Selects one available slot and updates the booking recap.
        if (submitting || createdReservation != null || !slot.isAvailable) return;
        selectedSlot = slot;
        slotAdapter.setSelectedSlotId(slot.slotId);
        hideCreateError();
        renderSummary();
        updateActions();
    }

    private void renderSummary() {
        // Shows the current station, date, time, and public slot ID.
        if (selectedStation == null || selectedSlot == null) {
            selectedSummaryCard.setVisibility(View.GONE);
            updateActions();
            return;
        }
        Date start = TimeUtils.parseApiDate(selectedSlot.startTime);
        Date end = TimeUtils.parseApiDate(selectedSlot.endTime);
        if (start == null || end == null) {
            selectedSummaryCard.setVisibility(View.GONE);
            updateActions();
            return;
        }
        summaryStationText.setText(selectedStation.name == null
                ? selectedStation.stationId : selectedStation.name);
        summaryDateText.setText(TimeUtils.formatLongDate(start));
        summaryTimeText.setText(getString(R.string.slot_time_range,
                TimeUtils.formatTime(start), TimeUtils.formatTime(end)));
        summarySlotText.setText(selectedSlot.slotId);
        selectedSummaryCard.setVisibility(View.VISIBLE);
        updateActions();
    }

    private void createReservation() {
        // Sends IDs and the slot's original UTC start time; the API validates all rules.
        if (submitting || createdReservation != null
                || selectedStation == null || selectedSlot == null
                || !selectedStation.isActive || !selectedSlot.isAvailable) {
            return;
        }
        hideCreateError();
        submitting = true;
        createButton.setText(R.string.reservation_creating);
        submitProgress.setVisibility(View.VISIBLE);
        updateActions();

        CreateReservationRequest request = new CreateReservationRequest(
                selectedStation.stationId, selectedSlot.slotId, selectedSlot.startTime);
        createCall = NetworkManager.getInstance().getApiService().createReservation(request);
        final Call<ApiResponse<ReservationData>> call = createCall;
        call.enqueue(new Callback<ApiResponse<ReservationData>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<ReservationData>> requestCall,
                                   @NonNull Response<ApiResponse<ReservationData>> response) {
                // A confirmed server reservation is the only success condition.
                if (isFinishing() || isDestroyed() || call != createCall || call.isCanceled()) {
                    return;
                }
                submitting = false;
                submitProgress.setVisibility(View.GONE);
                createButton.setText(R.string.reservation_create);
                ApiResponse<ReservationData> body = response.body();
                if (response.isSuccessful() && body != null && body.success
                        && body.data != null && body.data.reservationId != null
                        && !body.data.reservationId.isEmpty()) {
                    onReservationCreated(body.data, body.message);
                } else {
                    updateActions();
                    showCreateError(response.isSuccessful()
                            ? getString(R.string.reservation_incomplete_response)
                            : ApiErrorParser.getMessage(CreateReservationActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<ReservationData>> requestCall,
                                  @NonNull Throwable error) {
                // Keeps the chosen booking visible when the result cannot be confirmed.
                if (isFinishing() || isDestroyed() || call != createCall || call.isCanceled()) {
                    return;
                }
                submitting = false;
                submitProgress.setVisibility(View.GONE);
                createButton.setText(R.string.reservation_create);
                updateActions();
                showCreateError(getString(R.string.error_network));
            }
        });
    }

    private void onReservationCreated(ReservationData reservation, String message) {
        // Holds the actual API result; Step 2 will navigate to its dedicated summary Activity.
        createdReservation = reservation;
        hideCreateError();
        showCreatedResult(message == null || message.isEmpty()
                ? getString(R.string.reservation_created_message) : message);
        updateActions();
    }

    private void showCreatedResult(String message) {
        // Temporarily displays the confirmed API result within this Activity.
        createdMessageText.setText(message);
        createdIdText.setText(createdReservation.reservationId);
        createdStatusText.setText(createdReservation.status == null
                ? getString(R.string.metric_empty) : createdReservation.status);
        createdCard.setVisibility(View.VISIBLE);
        bottomActionBar.setVisibility(View.GONE);
        createdCard.post(() -> reservationScroll.smoothScrollTo(0, createdCard.getTop()));
    }

    private void showCreateError(String message) {
        // Keeps an API or network failure visible until the user changes selection or retries.
        createErrorText.setText(message);
        createErrorBanner.setVisibility(View.VISIBLE);
        createErrorBanner.post(() ->
                reservationScroll.smoothScrollTo(0, createErrorBanner.getTop()));
    }

    private void hideCreateError() {
        // Clears a previous mutation error after a meaningful selection change.
        createErrorBanner.setVisibility(View.GONE);
    }

    private void updateActions() {
        // Enables only actions whose required live data is ready.
        if (slotAdapter == null) return;
        stationButton.setEnabled(!stationsLoading && !submitting
                && createdReservation == null && !activeStations.isEmpty());
        refreshSlotsButton.setEnabled(selectedStation != null && !slotsLoading
                && !submitting && createdReservation == null);
        createButton.setEnabled(selectedStation != null && selectedSlot != null
                && selectedStation.isActive && selectedSlot.isAvailable
                && !slotsLoading && !submitting && createdReservation == null);
        slotAdapter.setInteractionEnabled(!slotsLoading && !submitting
                && createdReservation == null);
        bottomActionBar.setVisibility(
                createdReservation == null ? View.VISIBLE : View.GONE);
    }
}
// File: CreateReservationActivity.java
// Purpose: Prosumer reservation from the map or Home: choose an active station and a live available slot.

package com.example.smart_solar_mobile.activities;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.IntentCompat;
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
import java.util.Collections;
import java.util.Date;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CreateReservationActivity extends AppCompatActivity {
    public static final String EXTRA_STATION = "station";
    private static final String STATE_STATION = "selected_station";
    private static final String STATE_SELECTED_DAY = "selected_day";
    private static final String STATE_SLOT_ID = "selected_slot_id";

    private final DecimalFormat capacityFormat = new DecimalFormat("0.##");
    // Every available upcoming slot at the station; the day row filters these on the phone.
    private final List<EnergyBookingSlot> upcomingSlots = new ArrayList<>();
    private final List<SolarStation> activeStations = new ArrayList<>();
    private final List<Date> days = new ArrayList<>();
    private final List<View> dayChips = new ArrayList<>();

    private SolarStation selectedStation;
    private Date selectedDay;
    private EnergyBookingSlot selectedSlot;
    private ReservationData createdReservation;
    private String restoredSlotId;

    private Call<ApiResponse<List<EnergyBookingSlot>>> slotsCall;
    private Call<ApiResponse<List<SolarStation>>> stationsCall;
    private Call<ApiResponse<ReservationData>> createCall;

    private boolean sessionReady;
    private boolean stationsLoading;
    private boolean stationsLoaded;
    private String stationsError;
    private boolean slotsLoading;
    private boolean submitting;

    private ReservationSlotAdapter slotAdapter;
    private NestedScrollView reservationScroll;
    private RecyclerView slotsList;
    private LinearLayout dayRow;
    private View dayScroller;

    private TextView bookingNicText;
    private TextView stationNameText;
    private TextView stationIdText;
    private TextView stationScheduleText;
    private TextView stationCapacityText;
    private TextView stationStateText;
    private TextView slotsStateTitle;
    private TextView slotsStateMessage;
    private TextView availableCountText;
    private TextView summaryStationText;
    private TextView summaryDateText;
    private TextView summaryTimeText;
    private TextView summarySlotText;
    private TextView createErrorText;

    private View slotsLoadingView;
    private View stationLoadingView;
    private View slotsStateCard;
    private View selectedSummaryCard;
    private View createErrorBanner;
    private View bottomActionBar;
    private View submitProgress;

    private MaterialButton refreshSlotsButton;
    private MaterialButton chooseStationButton;
    private MaterialButton retrySlotsButton;
    private MaterialButton createButton;

    public static Intent intentFor(Context context, SolarStation station) {
        // Builds the intent the map's station popup uses to open this screen for one station.
        return new Intent(context, CreateReservationActivity.class).putExtra(EXTRA_STATION, station);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds either booking entry path, restores selection, and checks the Prosumer session.
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_reservation);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.createReservationRoot));
        bindViews();

        selectedStation = IntentCompat.getSerializableExtra(getIntent(), EXTRA_STATION, SolarStation.class);
        if (savedInstanceState != null && savedInstanceState.containsKey(STATE_STATION)) {
            selectedStation = (SolarStation) savedInstanceState.getSerializable(STATE_STATION);
        }
        if (selectedStation != null && (!selectedStation.isActive
                || selectedStation.stationId == null
                || selectedStation.stationId.trim().isEmpty())) {
            selectedStation = null;
        }

        slotAdapter = new ReservationSlotAdapter(this::onSlotSelected);
        slotsList.setLayoutManager(new LinearLayoutManager(this));
        slotsList.setNestedScrollingEnabled(false);
        slotsList.setAdapter(slotAdapter);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        chooseStationButton.setOnClickListener(v -> openStationPicker());
        refreshSlotsButton.setOnClickListener(v ->
                loadSlots(selectedSlot == null ? null : selectedSlot.slotId));
        retrySlotsButton.setOnClickListener(v -> loadSlots(null));
        createButton.setOnClickListener(v -> createReservation());

        if (savedInstanceState != null) {
            restoredSlotId = savedInstanceState.getString(STATE_SLOT_ID);
            long restoredDay = savedInstanceState.getLong(STATE_SELECTED_DAY, 0);
            if (restoredDay != 0) {
                selectedDay = new Date(restoredDay);
            }
        }

        renderStation();
        if (selectedStation == null && createdReservation == null) {
            showSlotsState(getString(R.string.reservation_choose_station_title),
                    getString(R.string.reservation_choose_station_body), false);
        }
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
            sessionReady = true;
            updateActions();
            if (createdReservation == null) {
                if (selectedStation == null) {
                    loadStations(false);
                } else {
                    loadSlots(restoredSlotId);
                }
            }
            restoredSlotId = null;
        });
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Retains the chosen day and slot across screen recreation.
        super.onSaveInstanceState(outState);
        outState.putSerializable(STATE_STATION, selectedStation);
        if (selectedDay != null) {
            outState.putLong(STATE_SELECTED_DAY, selectedDay.getTime());
        }
        outState.putString(STATE_SLOT_ID,
                selectedSlot == null ? restoredSlotId : selectedSlot.slotId);
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
        dayRow = findViewById(R.id.dayRow);
        dayScroller = findViewById(R.id.dayScroller);
        bookingNicText = findViewById(R.id.bookingNicText);
        stationNameText = findViewById(R.id.stationNameText);
        stationIdText = findViewById(R.id.stationIdText);
        stationScheduleText = findViewById(R.id.stationScheduleText);
        stationCapacityText = findViewById(R.id.stationCapacityText);
        stationStateText = findViewById(R.id.stationStateText);
        slotsStateTitle = findViewById(R.id.slotsStateTitle);
        slotsStateMessage = findViewById(R.id.slotsStateMessage);
        availableCountText = findViewById(R.id.availableCountText);
        summaryStationText = findViewById(R.id.summaryStationText);
        summaryDateText = findViewById(R.id.summaryDateText);
        summaryTimeText = findViewById(R.id.summaryTimeText);
        summarySlotText = findViewById(R.id.summarySlotText);
        createErrorText = findViewById(R.id.createErrorText);

        slotsLoadingView = findViewById(R.id.slotsLoadingView);
        stationLoadingView = findViewById(R.id.stationLoadingView);
        slotsStateCard = findViewById(R.id.slotsStateCard);
        selectedSummaryCard = findViewById(R.id.selectedSummaryCard);
        createErrorBanner = findViewById(R.id.createErrorBanner);
        bottomActionBar = findViewById(R.id.bottomActionBar);
        submitProgress = findViewById(R.id.submitProgress);

        refreshSlotsButton = findViewById(R.id.refreshSlotsButton);
        chooseStationButton = findViewById(R.id.chooseStationButton);
        retrySlotsButton = findViewById(R.id.retrySlotsButton);
        createButton = findViewById(R.id.createButton);
    }

    private void renderStation() {
        // Shows real station fields and a visible loading, empty, or API error state.
        if (selectedStation == null) {
            stationNameText.setText(R.string.reservation_station_unselected);
            stationIdText.setVisibility(View.GONE);
            stationScheduleText.setVisibility(View.GONE);
            stationCapacityText.setVisibility(View.GONE);
        } else {
            stationNameText.setText(selectedStation.name == null
                    || selectedStation.name.trim().isEmpty()
                    ? selectedStation.stationId : selectedStation.name);
            stationIdText.setText(selectedStation.stationId);
            stationIdText.setVisibility(View.VISIBLE);

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

        stationLoadingView.setVisibility(stationsLoading ? View.VISIBLE : View.GONE);
        if (stationsLoading) {
            stationStateText.setVisibility(View.GONE);
        } else if (stationsError != null) {
            stationStateText.setText(stationsError);
            stationStateText.setBackgroundResource(R.drawable.bg_error_banner);
            stationStateText.setTextColor(getColor(R.color.on_error_container));
            stationStateText.setVisibility(View.VISIBLE);
        } else if (selectedStation == null) {
            stationStateText.setText(stationsLoaded && activeStations.isEmpty()
                    ? R.string.reservation_no_active_stations
                    : R.string.reservation_station_prompt);
            stationStateText.setBackgroundResource(R.drawable.bg_icon_tile);
            stationStateText.setTextColor(getColor(R.color.on_surface_variant));
            stationStateText.setVisibility(View.VISIBLE);
        } else {
            stationStateText.setVisibility(View.GONE);
        }

        chooseStationButton.setText(stationsError != null
                || (stationsLoaded && activeStations.isEmpty())
                ? R.string.reservation_retry_stations
                : selectedStation == null
                ? R.string.reservation_choose_station
                : R.string.reservation_change_station);
        chooseStationButton.setVisibility(
                createdReservation == null ? View.VISIBLE : View.GONE);
    }

    private void loadStations(boolean openPickerAfterLoad) {
        // Loads the shared station API and offers only active stations to the picker.
        if (!sessionReady || stationsLoading || submitting || createdReservation != null) return;
        if (stationsCall != null) stationsCall.cancel();
        stationsLoading = true;
        stationsError = null;
        renderStation();
        updateActions();

        stationsCall = NetworkManager.getInstance().getApiService().getStations();
        final Call<ApiResponse<List<SolarStation>>> call = stationsCall;
        call.enqueue(new Callback<ApiResponse<List<SolarStation>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<SolarStation>>> request,
                                   @NonNull Response<ApiResponse<List<SolarStation>>> response) {
                // Ignores a reply replaced by a newer station request.
                if (isFinishing() || isDestroyed() || call != stationsCall || call.isCanceled()) return;
                stationsLoading = false;
                ApiResponse<List<SolarStation>> body = response.body();
                if (!response.isSuccessful() || body == null || !body.success || body.data == null) {
                    stationsLoaded = false;
                    activeStations.clear();
                    stationsError = response.isSuccessful() && body != null
                            && body.message != null && !body.message.trim().isEmpty()
                            ? body.message
                            : response.isSuccessful()
                            ? getString(R.string.station_unavailable)
                            : ApiErrorParser.getMessage(CreateReservationActivity.this, response);
                    renderStation();
                    updateActions();
                    return;
                }

                stationsLoaded = true;
                activeStations.clear();
                for (SolarStation station : body.data) {
                    if (station != null && station.isActive && station.stationId != null
                            && !station.stationId.trim().isEmpty()) {
                        activeStations.add(station);
                    }
                }

                if (selectedStation != null) {
                    SolarStation refreshed = null;
                    for (SolarStation station : activeStations) {
                        if (station.stationId.equals(selectedStation.stationId)) {
                            refreshed = station;
                            break;
                        }
                    }
                    if (refreshed == null) {
                        clearStationSelection();
                    } else {
                        selectedStation = refreshed;
                    }
                }
                renderStation();
                updateActions();
                if (openPickerAfterLoad && !activeStations.isEmpty()) {
                    showStationPicker();
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<SolarStation>>> request,
                                  @NonNull Throwable error) {
                // Keeps a retry action and the network error visible.
                if (isFinishing() || isDestroyed() || call != stationsCall || call.isCanceled()) return;
                stationsLoading = false;
                stationsLoaded = false;
                activeStations.clear();
                stationsError = getString(R.string.error_network);
                renderStation();
                updateActions();
            }
        });
    }

    private void openStationPicker() {
        // Reuses the Member 02 searchable bottom sheet with active stations only.
        if (!sessionReady || stationsLoading || submitting || createdReservation != null) return;
        if (stationsError != null || !stationsLoaded || activeStations.isEmpty()) {
            loadStations(true);
        } else {
            showStationPicker();
        }
    }

    private void showStationPicker() {
        // The API remains authoritative if station state changes after this list loads.
        StationPickerDialog.show(this, activeStations,
                selectedStation == null ? null : selectedStation.stationId,
                this::selectStation);
    }

    private void selectStation(SolarStation station) {
        // Replaces slot/date selection only when the station really changes.
        if (station == null || !station.isActive || station.stationId == null
                || station.stationId.trim().isEmpty()
                || submitting || createdReservation != null) return;
        if (selectedStation != null
                && station.stationId.equals(selectedStation.stationId)) {
            selectedStation = station;
            renderStation();
            return;
        }
        selectedStation = station;
        selectedDay = null;
        restoredSlotId = null;
        hideCreateError();
        renderStation();
        loadSlots(null);
    }

    private void clearStationSelection() {
        // Invalidates slots from a station the refreshed list no longer marks active.
        if (slotsCall != null) {
            slotsCall.cancel();
            slotsCall = null;
        }
        selectedStation = null;
        selectedDay = null;
        selectedSlot = null;
        slotsLoading = false;
        upcomingSlots.clear();
        days.clear();
        dayChips.clear();
        dayRow.removeAllViews();
        dayScroller.setVisibility(View.GONE);
        slotAdapter.setSlots(new ArrayList<>(), null);
        slotsLoadingView.setVisibility(View.GONE);
        slotsList.setVisibility(View.GONE);
        availableCountText.setVisibility(View.GONE);
        showSlotsState(getString(R.string.reservation_choose_station_title),
                getString(R.string.reservation_choose_station_body), false);
        renderSummary();
        updateActions();
    }

    private void buildDayRow() {
        // Derives every local date from the actual bookable slots returned by the API.
        dayRow.removeAllViews();
        days.clear();
        dayChips.clear();
        LayoutInflater inflater = getLayoutInflater();
        String previousDayKey = null;
        for (EnergyBookingSlot slot : upcomingSlots) {
            Date start = TimeUtils.parseApiDate(slot.startTime);
            if (start == null) continue;
            String dayKey = TimeUtils.dayKey(start);
            if (dayKey.equals(previousDayKey)) continue;
            previousDayKey = dayKey;
            Date day = TimeUtils.startOfDay(start);
            View chip = inflater.inflate(R.layout.item_day_chip, dayRow, false);
            TextView weekdayText = chip.findViewById(R.id.dayChipWeekday);
            TextView numberText = chip.findViewById(R.id.dayChipNumber);
            weekdayText.setText(TimeUtils.isSameLocalDay(day, new Date())
                    ? getString(R.string.today) : TimeUtils.formatWeekdayShort(day));
            numberText.setText(String.valueOf(TimeUtils.dayOfMonth(day)));
            chip.setOnClickListener(v -> selectDay(day));
            dayRow.addView(chip);
            days.add(day);
            dayChips.add(chip);
        }
        renderDayRow();
    }

    private void renderDayRow() {
        // Marks the chosen day and puts a dot on the days that have open slots.
        dayScroller.setVisibility(days.isEmpty() ? View.GONE : View.VISIBLE);
        for (int i = 0; i < days.size(); i++) {
            Date day = days.get(i);
            View chip = dayChips.get(i);
            int count = countSlotsOn(day);
            boolean selected = selectedDay != null
                    && TimeUtils.isSameLocalDay(day, selectedDay);
            chip.setSelected(selected);
            chip.findViewById(R.id.dayChipDot).setVisibility(count > 0 ? View.VISIBLE : View.INVISIBLE);
            chip.setContentDescription(getString(R.string.reservation_day_description,
                    TimeUtils.formatLongDate(day),
                    getResources().getQuantityString(R.plurals.reservation_available_count, count, count))
                    + (selected ? ", " + getString(R.string.reservation_selected) : ""));
        }
    }

    private int countSlotsOn(Date day) {
        // Counts the loaded available slots that start on the given local day.
        int count = 0;
        for (EnergyBookingSlot slot : upcomingSlots) {
            Date start = TimeUtils.parseApiDate(slot.startTime);
            if (start != null && TimeUtils.isSameLocalDay(start, day)) count++;
        }
        return count;
    }

    private boolean isShownDay(Date day) {
        // True when the day is represented by the current API response.
        if (day == null) return false;
        for (Date shown : days) {
            if (TimeUtils.isSameLocalDay(shown, day)) return true;
        }
        return false;
    }

    private void selectDay(Date day) {
        // Filters the slot list to the tapped day; a slot picked on another day is cleared.
        if (slotsLoading || submitting || createdReservation != null) return;
        if (selectedDay != null && TimeUtils.isSameLocalDay(day, selectedDay)) return;
        selectedDay = day;
        hideCreateError();
        showDaySlots(selectedSlot == null ? null : selectedSlot.slotId);
    }

    private void loadSlots(String slotIdToKeep) {
        // Loads upcoming slots; the returned data defines the visible dates.
        if (!sessionReady || selectedStation == null || !selectedStation.isActive
                || selectedStation.stationId == null || submitting
                || createdReservation != null) return;
        if (slotsCall != null) slotsCall.cancel();

        String stationId = selectedStation.stationId;
        selectedSlot = null;
        upcomingSlots.clear();
        days.clear();
        dayChips.clear();
        dayRow.removeAllViews();
        dayScroller.setVisibility(View.GONE);
        slotAdapter.setSlots(new ArrayList<>(), null);
        slotsLoading = true;
        slotsLoadingView.setVisibility(View.VISIBLE);
        slotsStateCard.setVisibility(View.GONE);
        slotsList.setVisibility(View.GONE);
        availableCountText.setVisibility(View.GONE);
        renderSummary();
        updateActions();

        slotsCall = NetworkManager.getInstance().getApiService().getUpcomingSlots(stationId);
        final Call<ApiResponse<List<EnergyBookingSlot>>> call = slotsCall;
        call.enqueue(new Callback<ApiResponse<List<EnergyBookingSlot>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> request,
                                   @NonNull Response<ApiResponse<List<EnergyBookingSlot>>> response) {
                // Ignores late or replaced replies.
                if (isFinishing() || isDestroyed() || call != slotsCall || call.isCanceled()) {
                    return;
                }
                slotsLoading = false;
                slotsLoadingView.setVisibility(View.GONE);
                ApiResponse<List<EnergyBookingSlot>> body = response.body();
                if (!response.isSuccessful() || body == null || !body.success
                        || body.data == null) {
                    showSlotsState(getString(R.string.reservation_slots_error_title),
                            response.isSuccessful() && body != null
                                    && body.message != null && !body.message.trim().isEmpty()
                                    ? body.message
                                    : response.isSuccessful()
                                    ? getString(R.string.reservation_slots_error_title)
                                    : ApiErrorParser.getMessage(CreateReservationActivity.this, response),
                            true);
                    renderDayRow();
                    updateActions();
                    return;
                }

                for (EnergyBookingSlot slot : body.data) {
                    if (slot != null && slot.isAvailable
                            && stationId.equals(slot.stationId)
                            && slot.slotId != null && !slot.slotId.trim().isEmpty()
                            && TimeUtils.parseApiDate(slot.startTime) != null
                            && TimeUtils.parseApiDate(slot.endTime) != null) {
                        upcomingSlots.add(slot);
                    }
                }

                Collections.sort(upcomingSlots, (left, right) ->
                        TimeUtils.parseApiDate(left.startTime)
                                .compareTo(TimeUtils.parseApiDate(right.startTime)));
                buildDayRow();
                // Retains a restored day only if the new API response still contains it.
                if (!isShownDay(selectedDay)) {
                    selectedDay = days.isEmpty() ? null : days.get(0);
                }
                showDaySlots(slotIdToKeep);
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> request,
                                  @NonNull Throwable error) {
                // Keeps a visible retry state when the slot request fails.
                if (isFinishing() || isDestroyed() || call != slotsCall || call.isCanceled()) {
                    return;
                }
                slotsLoading = false;
                slotsLoadingView.setVisibility(View.GONE);
                showSlotsState(getString(R.string.reservation_slots_error_title),
                        getString(R.string.error_network), true);
                renderDayRow();
                updateActions();
            }
        });
    }

    private void showDaySlots(String slotIdToKeep) {
        // Shows the chosen day's available slots, keeping the picked slot if it is on that day.
        List<EnergyBookingSlot> daySlots = new ArrayList<>();
        for (EnergyBookingSlot slot : upcomingSlots) {
            Date start = TimeUtils.parseApiDate(slot.startTime);
            if (start != null && selectedDay != null
                    && TimeUtils.isSameLocalDay(start, selectedDay)) daySlots.add(slot);
        }

        selectedSlot = null;
        if (slotIdToKeep != null) {
            for (EnergyBookingSlot slot : daySlots) {
                if (slotIdToKeep.equals(slot.slotId)) {
                    selectedSlot = slot;
                    break;
                }
            }
        }
        slotAdapter.setSlots(daySlots, selectedSlot == null ? null : selectedSlot.slotId);

        availableCountText.setText(getResources().getQuantityString(
                R.plurals.reservation_available_count, daySlots.size(), daySlots.size()));
        availableCountText.setVisibility(upcomingSlots.isEmpty() ? View.GONE : View.VISIBLE);
        if (upcomingSlots.isEmpty()) {
            showSlotsState(getString(R.string.reservation_no_slots_title),
                    getString(R.string.reservation_no_slots_body), false);
        } else if (daySlots.isEmpty()) {
            showSlotsState(getString(R.string.reservation_day_no_slots_title,
                            TimeUtils.formatShortDate(selectedDay)),
                    getString(R.string.reservation_day_no_slots_body), false);
        } else {
            slotsStateCard.setVisibility(View.GONE);
            slotsList.setVisibility(View.VISIBLE);
        }
        renderDayRow();
        renderSummary();
        updateActions();
    }

    private void showSlotsState(String title, String message, boolean retry) {
        // Gives empty and failed slot lists distinct, readable states.
        slotsStateTitle.setText(title);
        slotsStateMessage.setText(message);
        retrySlotsButton.setVisibility(retry ? View.VISIBLE : View.GONE);
        slotsStateCard.setVisibility(View.VISIBLE);
        slotsList.setVisibility(View.GONE);
    }

    private void onSlotSelected(EnergyBookingSlot slot) {
        // Selects one available slot and updates the booking recap.
        if (!sessionReady || slotsLoading || submitting || createdReservation != null
                || selectedStation == null || slot == null || !slot.isAvailable
                || !selectedStation.stationId.equals(slot.stationId)) return;
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
        if (!sessionReady || slotsLoading || submitting || createdReservation != null
                || selectedStation == null || selectedSlot == null
                || !selectedStation.isActive || !selectedSlot.isAvailable
                || !selectedStation.stationId.equals(selectedSlot.stationId)) {
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
                    onReservationCreated(body.data);
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

    private void onReservationCreated(ReservationData reservation) {
        // Opens the dedicated result with the confirmed API object and retires this form.
        createdReservation = reservation;
        hideCreateError();
        updateActions();
        ReservationSummaryActivity.open(this, ReservationSummaryActivity.Action.CREATE, reservation);
        finish();
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
        boolean canChoose = sessionReady && !slotsLoading
                && !submitting && createdReservation == null;
        for (View chip : dayChips) {
            chip.setEnabled(canChoose);
        }
        chooseStationButton.setEnabled(sessionReady && !stationsLoading
                && !submitting && createdReservation == null);
        refreshSlotsButton.setEnabled(selectedStation != null
                && selectedStation.isActive && canChoose);
        createButton.setEnabled(selectedStation != null && selectedSlot != null
                && selectedStation.isActive && selectedSlot.isAvailable && canChoose);
        slotAdapter.setInteractionEnabled(canChoose);
        bottomActionBar.setVisibility(
                createdReservation == null ? View.VISIBLE : View.GONE);
    }
}

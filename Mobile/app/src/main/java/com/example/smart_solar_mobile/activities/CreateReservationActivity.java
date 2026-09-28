// File: CreateReservationActivity.java
// Purpose: Prosumer reservation for the station chosen on the map: pick one of the next 7 days, then an available slot.

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
import java.util.Calendar;
import java.util.Date;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CreateReservationActivity extends AppCompatActivity {
    public static final String EXTRA_STATION = "station";
    private static final int DAYS_SHOWN = 7;
    private static final String STATE_SELECTED_DAY = "selected_day";
    private static final String STATE_SLOT_ID = "selected_slot_id";
    private static final String STATE_CREATED_ID = "created_reservation_id";
    private static final String STATE_CREATED_STATUS = "created_reservation_status";

    private final DecimalFormat capacityFormat = new DecimalFormat("0.##");
    // Every available upcoming slot at the station; the day row filters these on the phone.
    private final List<EnergyBookingSlot> upcomingSlots = new ArrayList<>();
    private final List<Date> days = new ArrayList<>();
    private final List<View> dayChips = new ArrayList<>();

    private SolarStation selectedStation;
    private Date selectedDay;
    private EnergyBookingSlot selectedSlot;
    private ReservationData createdReservation;
    private String restoredSlotId;

    private Call<ApiResponse<List<EnergyBookingSlot>>> slotsCall;
    private Call<ApiResponse<ReservationData>> createCall;

    private boolean slotsLoading;
    private boolean submitting;

    private ReservationSlotAdapter slotAdapter;
    private NestedScrollView reservationScroll;
    private RecyclerView slotsList;
    private LinearLayout dayRow;

    private TextView bookingNicText;
    private TextView stationNameText;
    private TextView stationIdText;
    private TextView stationScheduleText;
    private TextView stationCapacityText;
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

    private View slotsLoadingView;
    private View slotsStateCard;
    private View selectedSummaryCard;
    private View createErrorBanner;
    private View createdCard;
    private View bottomActionBar;
    private View submitProgress;

    private MaterialButton refreshSlotsButton;
    private MaterialButton retrySlotsButton;
    private MaterialButton createButton;

    public static Intent intentFor(Context context, SolarStation station) {
        // Builds the intent the map's station popup uses to open this screen for one station.
        return new Intent(context, CreateReservationActivity.class).putExtra(EXTRA_STATION, station);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds the booking screen for the station passed in, restores selection, and checks the Prosumer session.
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_reservation);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.createReservationRoot));
        bindViews();

        selectedStation = IntentCompat.getSerializableExtra(getIntent(), EXTRA_STATION, SolarStation.class);
        if (selectedStation == null) {
            // This screen is only reached from a station on the map
            finish();
            return;
        }

        slotAdapter = new ReservationSlotAdapter(this::onSlotSelected);
        slotsList.setLayoutManager(new LinearLayoutManager(this));
        slotsList.setNestedScrollingEnabled(false);
        slotsList.setAdapter(slotAdapter);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        refreshSlotsButton.setOnClickListener(v ->
                loadSlots(selectedSlot == null ? null : selectedSlot.slotId));
        retrySlotsButton.setOnClickListener(v -> loadSlots(null));
        createButton.setOnClickListener(v -> createReservation());
        findViewById(R.id.doneButton).setOnClickListener(v -> finish());

        if (savedInstanceState != null) {
            restoredSlotId = savedInstanceState.getString(STATE_SLOT_ID);
            long restoredDay = savedInstanceState.getLong(STATE_SELECTED_DAY, 0);
            if (restoredDay != 0) {
                selectedDay = new Date(restoredDay);
            }
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
        buildDayRow();
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
            loadSlots(restoredSlotId);
            restoredSlotId = null;
        });
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Retains the chosen day, slot and confirmed result across screen recreation.
        super.onSaveInstanceState(outState);
        if (selectedDay != null) {
            outState.putLong(STATE_SELECTED_DAY, selectedDay.getTime());
        }
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
        if (slotsCall != null) slotsCall.cancel();
        if (createCall != null) createCall.cancel();
        super.onDestroy();
    }

    private void bindViews() {
        // Finds the existing XML views once.
        reservationScroll = findViewById(R.id.reservationScroll);
        slotsList = findViewById(R.id.slotsList);
        dayRow = findViewById(R.id.dayRow);
        bookingNicText = findViewById(R.id.bookingNicText);
        stationNameText = findViewById(R.id.stationNameText);
        stationIdText = findViewById(R.id.stationIdText);
        stationScheduleText = findViewById(R.id.stationScheduleText);
        stationCapacityText = findViewById(R.id.stationCapacityText);
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

        slotsLoadingView = findViewById(R.id.slotsLoadingView);
        slotsStateCard = findViewById(R.id.slotsStateCard);
        selectedSummaryCard = findViewById(R.id.selectedSummaryCard);
        createErrorBanner = findViewById(R.id.createErrorBanner);
        createdCard = findViewById(R.id.createdCard);
        bottomActionBar = findViewById(R.id.bottomActionBar);
        submitProgress = findViewById(R.id.submitProgress);

        refreshSlotsButton = findViewById(R.id.refreshSlotsButton);
        retrySlotsButton = findViewById(R.id.retrySlotsButton);
        createButton = findViewById(R.id.createButton);
    }

    private void renderStation() {
        // Shows the real fields of the station chosen on the map.
        stationNameText.setText(selectedStation.name == null
                ? selectedStation.stationId : selectedStation.name);
        stationIdText.setText(selectedStation.stationId);

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

    private void buildDayRow() {
        // Adds one button for each of the next 7 days, starting today; tapping one filters the slots to that day.
        dayRow.removeAllViews();
        days.clear();
        dayChips.clear();
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(TimeUtils.startOfDay(new Date()));
        LayoutInflater inflater = getLayoutInflater();
        for (int i = 0; i < DAYS_SHOWN; i++) {
            Date day = calendar.getTime();
            View chip = inflater.inflate(R.layout.item_day_chip, dayRow, false);
            TextView weekdayText = chip.findViewById(R.id.dayChipWeekday);
            TextView numberText = chip.findViewById(R.id.dayChipNumber);
            weekdayText.setText(i == 0 ? getString(R.string.today) : TimeUtils.formatWeekdayShort(day));
            numberText.setText(String.valueOf(TimeUtils.dayOfMonth(day)));
            chip.setOnClickListener(v -> selectDay(day));
            dayRow.addView(chip);
            days.add(day);
            dayChips.add(chip);
            calendar.add(Calendar.DAY_OF_MONTH, 1);
        }
        renderDayRow();
    }

    private void renderDayRow() {
        // Marks the chosen day and puts a dot on the days that have open slots.
        for (int i = 0; i < days.size(); i++) {
            Date day = days.get(i);
            View chip = dayChips.get(i);
            int count = countSlotsOn(day);
            chip.setSelected(selectedDay != null && TimeUtils.isSameLocalDay(day, selectedDay));
            chip.findViewById(R.id.dayChipDot).setVisibility(count > 0 ? View.VISIBLE : View.INVISIBLE);
            chip.setContentDescription(getString(R.string.reservation_day_description,
                    TimeUtils.formatLongDate(day),
                    getResources().getQuantityString(R.plurals.reservation_available_count, count, count)));
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

    private Date firstDayWithSlots() {
        // The first of the 7 days that has an open slot, or today when none do.
        for (Date day : days) {
            if (countSlotsOn(day) > 0) return day;
        }
        return days.get(0);
    }

    private boolean isShownDay(Date day) {
        // True when the day is one of the 7 in the row (a restored day can fall out of it overnight).
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
        // Loads the station's upcoming slots once; the 7-day row then filters them on the phone.
        if (selectedStation == null) return;
        if (slotsCall != null) slotsCall.cancel();

        String stationId = selectedStation.stationId;
        selectedSlot = null;
        upcomingSlots.clear();
        slotAdapter.setSlots(new ArrayList<>(), null);
        slotsLoading = true;
        slotsLoadingView.setVisibility(View.VISIBLE);
        slotsStateCard.setVisibility(View.GONE);
        slotsList.setVisibility(View.GONE);
        availableCountText.setVisibility(View.GONE);
        renderDayRow();
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
                if (!response.isSuccessful() || body == null || body.data == null) {
                    showSlotsState(getString(R.string.reservation_slots_error_title),
                            ApiErrorParser.getMessage(CreateReservationActivity.this, response),
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

                // Keeps the day chosen before (e.g. across rotation), otherwise starts on the first day with slots.
                if (!isShownDay(selectedDay)) {
                    selectedDay = firstDayWithSlots();
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
            if (start != null && TimeUtils.isSameLocalDay(start, selectedDay)) daySlots.add(slot);
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
        availableCountText.setVisibility(View.VISIBLE);
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
        boolean canChoose = !slotsLoading && !submitting && createdReservation == null;
        for (View chip : dayChips) {
            chip.setEnabled(canChoose);
        }
        refreshSlotsButton.setEnabled(selectedStation != null && canChoose);
        createButton.setEnabled(selectedStation != null && selectedSlot != null
                && selectedStation.isActive && selectedSlot.isAvailable && canChoose);
        slotAdapter.setInteractionEnabled(canChoose);
        bottomActionBar.setVisibility(
                createdReservation == null ? View.VISIBLE : View.GONE);
    }
}

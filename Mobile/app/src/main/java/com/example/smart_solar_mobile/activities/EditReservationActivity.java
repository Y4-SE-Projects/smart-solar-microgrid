// File: EditReservationActivity.java
// Purpose: Lets a Prosumer change a Pending reservation using live station and slot data.

package com.example.smart_solar_mobile.activities;

import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.widget.NestedScrollView;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.adapters.EditReservationSlotAdapter;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.EnergyBookingSlot;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.models.UpdateReservationRequest;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.ReservationStatusUi;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.button.MaterialButton;

import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class EditReservationActivity extends AppCompatActivity {

    private static final String EXTRA_ID = "edit_reservation.id";
    private static final String EXTRA_STATION = "edit_reservation.station";
    private static final String EXTRA_SLOT = "edit_reservation.slot";
    private static final String EXTRA_TIME = "edit_reservation.time";
    private static final String EXTRA_STATUS = "edit_reservation.status";
    private static final String STATE_SLOT = "edit_reservation.selected_slot";
    private static final String STATE_DAY = "edit_reservation.selected_day";
    private static final String STATE_UNCONFIRMED = "edit_reservation.unconfirmed_put";
    // The API serializes DateTime with up to seven fractional digits (100 ns units).
    private static final long TICKS_PER_MILLISECOND = 10_000L;
    private static final long MINIMUM_NOTICE_TICKS =
            TimeUnit.HOURS.toMillis(12) * TICKS_PER_MILLISECOND;
    private static final long EDIT_WINDOW_TICKS =
            TimeUnit.DAYS.toMillis(7) * TICKS_PER_MILLISECOND;
    private static final Pattern API_TIMESTAMP = Pattern.compile(
            "^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})(?:\\.(\\d{1,7}))?(Z|[+-]\\d{2}:\\d{2})?$");

    public static Intent intentFor(@NonNull Context context, @NonNull ReservationData reservation) {
        // Passes only confirmed fields needed to show and edit the selected Pending reservation.
        return new Intent(context, EditReservationActivity.class)
                .putExtra(EXTRA_ID, reservation.reservationId)
                .putExtra(EXTRA_STATION, reservation.stationId)
                .putExtra(EXTRA_SLOT, reservation.slotId)
                .putExtra(EXTRA_TIME, reservation.scheduledTime)
                .putExtra(EXTRA_STATUS, reservation.status);
    }

    private final List<EnergyBookingSlot> eligibleSlots = new ArrayList<>();
    private final List<Date> dates = new ArrayList<>();
    private final List<View> dayButtons = new ArrayList<>();

    private ReservationData original;
    private EnergyBookingSlot selectedSlot;
    private String selectedDayKey;
    private String restoredSlotId;
    private boolean sessionReady;
    private boolean isSlotsLoading;
    private boolean submitting;
    private boolean submissionUnconfirmed;

    private Call<ApiResponse<List<EnergyBookingSlot>>> slotsCall;
    private Call<ApiResponse<ReservationData>> updateCall;
    private EditReservationSlotAdapter slotAdapter;

    private NestedScrollView editScroll;
    private View editContent;
    private View fatalState;
    private TextView fatalTitle;
    private TextView fatalMessage;
    private TextView currentReference;
    private TextView currentStatus;
    private TextView currentStation;
    private TextView currentSlot;
    private TextView currentTime;
    private TextView stationName;
    private MaterialButton refreshSlotsButton;
    private View slotsLoadingView;
    private View slotsState;
    private TextView slotsStateTitle;
    private TextView slotsStateMessage;
    private MaterialButton retrySlotsButton;
    private TextView currentSlotNotice;
    private LinearLayout dateRow;
    private View dateScroller;
    private RecyclerView slotList;
    private View selectionCard;
    private TextView selectionKind;
    private TextView selectionStation;
    private TextView selectionDate;
    private TextView selectionTime;
    private TextView selectionSlot;
    private View updateErrorBanner;
    private TextView updateErrorText;
    private TextView saveHint;
    private View actionBar;
    private View submitProgress;
    private MaterialButton saveButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Restores the selected booking and gathers live choices without making a mutation.
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_reservation);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.editRoot));
        bindViews();
        readOriginal();

        slotAdapter = new EditReservationSlotAdapter(this::selectSlot);
        slotList.setLayoutManager(new LinearLayoutManager(this));
        slotList.setNestedScrollingEnabled(false);
        slotList.setAdapter(slotAdapter);

        findViewById(R.id.editBackButton).setOnClickListener(view -> finish());
        refreshSlotsButton.setOnClickListener(view ->
                loadSlots(selectedSlot == null ? null : selectedSlot.slotId));
        retrySlotsButton.setOnClickListener(view -> loadSlots(null));
        saveButton.setOnClickListener(view -> saveChanges());

        if (!hasText(original.reservationId) || !hasText(original.stationId)
                || !hasText(original.slotId) || !hasText(original.scheduledTime)
                || !hasText(original.status)) {
            showFatal(R.string.edit_unavailable_title, R.string.edit_unavailable_body);
            return;
        }
        renderOriginal();

        if (savedInstanceState != null) {
            restoredSlotId = savedInstanceState.getString(STATE_SLOT);
            selectedDayKey = savedInstanceState.getString(STATE_DAY);
            submissionUnconfirmed = savedInstanceState.getBoolean(STATE_UNCONFIRMED);
        } else {
            restoredSlotId = original.slotId;
        }

        if (submissionUnconfirmed) {
            showFatal(R.string.edit_unconfirmed_title, R.string.edit_unconfirmed_body);
            return;
        }

        renderStation();
        showSlotsState(R.string.edit_slots_initial_title,
                getString(R.string.edit_slots_initial_body), false);
        updateActions();

        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) return;
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || session.identifier == null || session.identifier.trim().isEmpty()) {
                Navigator.openLogin(this, false);
                return;
            }
            sessionReady = true;
            updateActions();
            loadSlots(restoredSlotId);
            restoredSlotId = null;
        });
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Retains selection and prevents a possibly completed PUT from being repeated after recreation.
        super.onSaveInstanceState(outState);
        outState.putString(STATE_SLOT,
                selectedSlot == null ? restoredSlotId : selectedSlot.slotId);
        outState.putString(STATE_DAY, selectedDayKey);
        outState.putBoolean(STATE_UNCONFIRMED, submitting);
    }

    @Override
    protected void onDestroy() {
        // Cancels callbacks bound to this Activity instance.
        if (slotsCall != null) slotsCall.cancel();
        if (updateCall != null) updateCall.cancel();
        super.onDestroy();
    }

    private void bindViews() {
        // Resolves the Activity's native view state in one place.
        editScroll = findViewById(R.id.editScroll);
        editContent = findViewById(R.id.editContent);
        fatalState = findViewById(R.id.editFatalState);
        fatalTitle = findViewById(R.id.editFatalTitle);
        fatalMessage = findViewById(R.id.editFatalMessage);
        currentReference = findViewById(R.id.editCurrentReference);
        currentStatus = findViewById(R.id.editCurrentStatus);
        currentStation = findViewById(R.id.editCurrentStation);
        currentSlot = findViewById(R.id.editCurrentSlot);
        currentTime = findViewById(R.id.editCurrentTime);
        stationName = findViewById(R.id.editStationName);
        refreshSlotsButton = findViewById(R.id.editRefreshSlotsButton);
        slotsLoadingView = findViewById(R.id.editSlotsLoading);
        slotsState = findViewById(R.id.editSlotsState);
        slotsStateTitle = findViewById(R.id.editSlotsStateTitle);
        slotsStateMessage = findViewById(R.id.editSlotsStateMessage);
        retrySlotsButton = findViewById(R.id.editRetrySlotsButton);
        currentSlotNotice = findViewById(R.id.editCurrentSlotNotice);
        dateRow = findViewById(R.id.editDateRow);
        dateScroller = findViewById(R.id.editDateScroller);
        slotList = findViewById(R.id.editSlotList);
        selectionCard = findViewById(R.id.editSelectionCard);
        selectionKind = findViewById(R.id.editSelectionKind);
        selectionStation = findViewById(R.id.editSelectionStation);
        selectionDate = findViewById(R.id.editSelectionDate);
        selectionTime = findViewById(R.id.editSelectionTime);
        selectionSlot = findViewById(R.id.editSelectionSlot);
        updateErrorBanner = findViewById(R.id.editUpdateErrorBanner);
        updateErrorText = findViewById(R.id.editUpdateErrorText);
        saveHint = findViewById(R.id.editSaveHint);
        actionBar = findViewById(R.id.editActionBar);
        submitProgress = findViewById(R.id.editSubmitProgress);
        saveButton = findViewById(R.id.editSaveButton);
    }

    private void readOriginal() {
        // Keeps the public reservation ID and current booking values from the selected server record.
        original = new ReservationData();
        Intent intent = getIntent();
        original.reservationId = intent.getStringExtra(EXTRA_ID);
        original.stationId = intent.getStringExtra(EXTRA_STATION);
        original.slotId = intent.getStringExtra(EXTRA_SLOT);
        original.scheduledTime = intent.getStringExtra(EXTRA_TIME);
        original.status = intent.getStringExtra(EXTRA_STATUS);
    }

    private void renderOriginal() {
        // Presents the current booking independently of replacement choices.
        currentReference.setText(original.reservationId);
        currentStation.setText(original.stationId);
        currentSlot.setText(original.slotId);
        Date scheduled = TimeUtils.parseApiDate(original.scheduledTime);
        currentTime.setText(scheduled == null ? original.scheduledTime
                : getString(R.string.detail_datetime_value,
                        TimeUtils.formatLongDate(scheduled), TimeUtils.formatTime(scheduled)));
        if ("Pending".equalsIgnoreCase(original.status)) {
            currentStatus.setText(ReservationStatusUi.chipLabel(original.status));
            currentStatus.setBackgroundResource(
                    ReservationStatusUi.chipBackground(original.status));
            currentStatus.setTextColor(getColor(
                    ReservationStatusUi.chipTextColor(original.status)));
        } else {
            currentStatus.setText(original.status);
            currentStatus.setBackgroundResource(R.drawable.bg_chip_neutral);
            currentStatus.setTextColor(getColor(R.color.on_surface_variant));
        }
    }

    private void renderStation() {
        // The original station ID is confirmed reservation data and cannot be edited.
        stationName.setText(original.stationId);
    }

    private void loadSlots(String preferredSlotId) {
        // Loads original-station slots and limits replacement choices to the rolling window.
        if (!sessionReady || !hasText(original.stationId) || submitting) return;
        if (slotsCall != null) slotsCall.cancel();
        selectedSlot = null;
        eligibleSlots.clear();
        dates.clear();
        dayButtons.clear();
        dateRow.removeAllViews();
        dateScroller.setVisibility(View.GONE);
        slotAdapter.setSlots(new ArrayList<>(), original.stationId,
                original.stationId, original.slotId, null);
        slotList.setVisibility(View.GONE);
        currentSlotNotice.setVisibility(View.GONE);
        isSlotsLoading = true;
        setSlotsLoadingVisible(true);
        renderSelection();
        updateActions();

        final String stationForCall = original.stationId;
        slotsCall = NetworkManager.getInstance().getApiService()
                .getStationSlots(stationForCall, null);
        final Call<ApiResponse<List<EnergyBookingSlot>>> call = slotsCall;
        call.enqueue(new Callback<ApiResponse<List<EnergyBookingSlot>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> request,
                                   @NonNull Response<ApiResponse<List<EnergyBookingSlot>>> response) {
                if (isFinishing() || isDestroyed() || call != slotsCall || call.isCanceled()) return;
                isSlotsLoading = false;
                setSlotsLoadingVisible(false);
                ApiResponse<List<EnergyBookingSlot>> body = response.body();
                if (!response.isSuccessful() || body == null || !body.success || body.data == null) {
                    String message = response.isSuccessful() && body != null && hasText(body.message)
                            ? body.message : response.isSuccessful()
                            ? getString(R.string.edit_slots_error_body)
                            : ApiErrorParser.getMessage(EditReservationActivity.this, response);
                    showSlotsState(R.string.edit_slots_error_title, message, true);
                    updateActions();
                    return;
                }

                boolean currentFound = false;
                for (EnergyBookingSlot slot : body.data) {
                    if (slot == null || !hasText(slot.slotId)
                            || !stationForCall.equals(slot.stationId)
                            || parseApiTicks(slot.startTime) == null
                            || TimeUtils.parseApiDate(slot.endTime) == null) continue;
                    boolean current = isCurrentSlot(slot);
                    if (current) currentFound = true;
                    if (isSelectableSlot(slot)) {
                        eligibleSlots.add(slot);
                    }
                }
                Collections.sort(eligibleSlots, (left, right) ->
                        TimeUtils.parseApiDate(left.startTime)
                                .compareTo(TimeUtils.parseApiDate(right.startTime)));

                for (EnergyBookingSlot slot : eligibleSlots) {
                    Date date = TimeUtils.startOfDay(TimeUtils.parseApiDate(slot.startTime));
                    if (!containsDay(date)) dates.add(date);
                    if (slot.slotId.equals(preferredSlotId)) selectedSlot = slot;
                }
                if (selectedSlot == null) {
                    for (EnergyBookingSlot slot : eligibleSlots) {
                        if (isCurrentSlot(slot)) {
                            selectedSlot = slot;
                            break;
                        }
                    }
                }
                if (selectedSlot != null) {
                    selectedDayKey = TimeUtils.dayKey(
                            TimeUtils.parseApiDate(selectedSlot.startTime));
                } else if (!containsDayKey(selectedDayKey)) {
                    selectedDayKey = dates.isEmpty() ? null : TimeUtils.dayKey(dates.get(0));
                }

                currentSlotNotice.setVisibility(!currentFound ? View.VISIBLE : View.GONE);
                renderDates();
                renderDaySlots();
                renderSelection();
                updateActions();
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> request,
                                  @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != slotsCall || call.isCanceled()) return;
                isSlotsLoading = false;
                setSlotsLoadingVisible(false);
                showSlotsState(R.string.edit_slots_error_title,
                        getString(R.string.error_network), true);
                updateActions();
            }
        });
    }

    private boolean isCurrentSlot(EnergyBookingSlot slot) {
        // The reservation already owns this slot even when the shared slot API marks it unavailable.
        return original.stationId.equals(slot.stationId)
                && original.slotId.equals(slot.slotId);
    }

    private boolean isSelectableSlot(EnergyBookingSlot slot) {
        // Keeps the owned slot selectable when unavailable; replacements need 12 hours' notice.
        if (slot == null || !hasText(slot.slotId)
                || !original.stationId.equals(slot.stationId)) return false;
        Long startTicks = parseApiTicks(slot.startTime);
        if (startTicks == null) return false;
        long nowTicks = System.currentTimeMillis() * TICKS_PER_MILLISECOND;
        // A current booking beyond the rolling window remains visible in its summary card.
        if (startTicks > nowTicks + EDIT_WINDOW_TICKS) return false;
        return isCurrentSlot(slot) || (slot.isAvailable
                && startTicks >= nowTicks + MINIMUM_NOTICE_TICKS);
    }

    private boolean containsDay(Date day) {
        // Keeps one date chip per local date represented by eligible live slots.
        for (Date item : dates) {
            if (TimeUtils.isSameLocalDay(item, day)) return true;
        }
        return false;
    }

    private boolean containsDayKey(String key) {
        // Tests a restored date against only dates present in the latest slot response.
        if (key == null) return false;
        for (Date day : dates) {
            if (key.equals(TimeUtils.dayKey(day))) return true;
        }
        return false;
    }

    private void renderDates() {
        // Builds accessible date choices from live slots without a fixed seven-day range.
        dateRow.removeAllViews();
        dayButtons.clear();
        for (Date day : dates) {
            String key = TimeUtils.dayKey(day);
            boolean selected = key.equals(selectedDayKey);
            MaterialButton button = new MaterialButton(this);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, dp(48));
            params.setMarginEnd(dp(8));
            button.setLayoutParams(params);
            button.setText(TimeUtils.formatShortDate(day));
            button.setTextSize(12);
            button.setAllCaps(false);
            button.setCornerRadius(dp(10));
            button.setStrokeWidth(dp(1));
            button.setStrokeColor(ColorStateList.valueOf(getColor(
                    selected ? R.color.primary : R.color.border_slate)));
            button.setBackgroundTintList(ColorStateList.valueOf(getColor(
                    selected ? R.color.primary : R.color.surface_container_lowest)));
            button.setTextColor(getColor(selected ? R.color.on_primary : R.color.on_surface));
            button.setContentDescription(getString(R.string.edit_date_description,
                    TimeUtils.formatLongDate(day), getString(selected
                            ? R.string.reservation_selected : R.string.edit_not_selected)));
            button.setOnClickListener(view -> selectDay(key));
            dateRow.addView(button);
            dayButtons.add(button);
        }
        dateScroller.setVisibility(dates.isEmpty() ? View.GONE : View.VISIBLE);
        updateActions();
    }

    private void selectDay(String key) {
        // Clears a chosen slot when the user browses to a different live date.
        if (isSlotsLoading || submitting || key.equals(selectedDayKey)) return;
        selectedDayKey = key;
        if (selectedSlot != null
                && !key.equals(TimeUtils.dayKey(
                        TimeUtils.parseApiDate(selectedSlot.startTime)))) {
            selectedSlot = null;
        }
        hideUpdateError();
        renderDates();
        renderDaySlots();
        renderSelection();
        updateActions();
    }

    private void renderDaySlots() {
        // Shows only this date's current slot or available replacement slots.
        if (eligibleSlots.isEmpty()) {
            showSlotsState(R.string.edit_no_slots_title,
                    getString(R.string.edit_no_slots_body), false);
            return;
        }
        List<EnergyBookingSlot> daySlots = new ArrayList<>();
        for (EnergyBookingSlot slot : eligibleSlots) {
            Date start = TimeUtils.parseApiDate(slot.startTime);
            if (start != null && TimeUtils.dayKey(start).equals(selectedDayKey)) {
                daySlots.add(slot);
            }
        }
        slotAdapter.setSlots(daySlots, original.stationId,
                original.stationId, original.slotId,
                selectedSlot == null ? null : selectedSlot.slotId);
        if (daySlots.isEmpty()) {
            showSlotsState(R.string.edit_no_slots_title,
                    getString(R.string.edit_no_slots_body), false);
        } else {
            slotsState.setVisibility(View.GONE);
            slotList.setVisibility(View.VISIBLE);
        }
    }

    private void selectSlot(EnergyBookingSlot slot) {
        // Accepts the owned current slot or an available live replacement, never another unavailable slot.
        if (slot == null || isSlotsLoading || submitting
                || !isSelectableSlot(slot)) return;
        selectedSlot = slot;
        selectedDayKey = TimeUtils.dayKey(TimeUtils.parseApiDate(slot.startTime));
        slotAdapter.setSelectedSlotId(slot.slotId);
        renderSelection();
        hideUpdateError();
        updateActions();
    }

    private void renderSelection() {
        // Distinguishes the unchanged current booking from a selected replacement.
        if (selectedSlot == null) {
            selectionCard.setVisibility(View.GONE);
            return;
        }
        Date start = TimeUtils.parseApiDate(selectedSlot.startTime);
        Date end = TimeUtils.parseApiDate(selectedSlot.endTime);
        selectionKind.setText(isNoChange()
                ? R.string.edit_current_selection : R.string.edit_replacement_selection);
        selectionStation.setText(original.stationId);
        selectionDate.setText(start == null ? selectedSlot.startTime
                : TimeUtils.formatLongDate(start));
        selectionTime.setText(start == null || end == null
                ? selectedSlot.startTime : getString(R.string.slot_time_range,
                        TimeUtils.formatTime(start), TimeUtils.formatTime(end)));
        selectionSlot.setText(selectedSlot.slotId);
        selectionCard.setVisibility(View.VISIBLE);
    }

    private boolean isNoChange() {
        // Compares the chosen slot and time; the station is fixed to the original booking.
        return selectedSlot != null
                && original.stationId.equals(selectedSlot.stationId)
                && selectedSlot.slotId.equals(original.slotId)
                && sameTime(selectedSlot.startTime, original.scheduledTime);
    }

    private static boolean sameTime(String a, String b) {
        // Avoids a meaningless PUT when ISO strings represent the same instant.
        Date first = TimeUtils.parseApiDate(a);
        Date second = TimeUtils.parseApiDate(b);
        return first != null && second != null ? first.equals(second)
                : a != null && a.equals(b);
    }

    private void setSlotsLoadingVisible(boolean loading) {
        // Keeps the fixed station context visible while slot choices load.
        slotsLoadingView.setVisibility(loading ? View.VISIBLE : View.GONE);
        if (loading) slotsState.setVisibility(View.GONE);
    }

    private void showSlotsState(int titleRes, String message, boolean retry) {
        // Explains empty, unavailable, and failed slot loads in the screen.
        slotsLoadingView.setVisibility(View.GONE);
        slotsStateTitle.setText(titleRes);
        slotsStateMessage.setText(message);
        retrySlotsButton.setVisibility(retry ? View.VISIBLE : View.GONE);
        slotsState.setVisibility(View.VISIBLE);
        slotList.setVisibility(View.GONE);
    }

    private void showFatal(int titleRes, int messageRes) {
        // Handles missing source data or an unconfirmed interrupted PUT without inventing state.
        editContent.setVisibility(View.GONE);
        actionBar.setVisibility(View.GONE);
        fatalTitle.setText(titleRes);
        fatalMessage.setText(messageRes);
        fatalState.setVisibility(View.VISIBLE);
    }

    private void showUpdateError(String message) {
        // Keeps server validation visible instead of reducing it to a Toast.
        updateErrorText.setText(message);
        updateErrorBanner.setVisibility(View.VISIBLE);
        updateErrorBanner.post(() ->
                editScroll.smoothScrollTo(0, updateErrorBanner.getBottom()));
    }

    private void hideUpdateError() {
        // Clears an old PUT error when the replacement choice changes.
        updateErrorBanner.setVisibility(View.GONE);
    }

    private void updateActions() {
        // Prevents no-change requests and repeated taps while live data or a PUT is in flight.
        if (slotAdapter == null) return;
        boolean canChoose = sessionReady && !isSlotsLoading
                && !submitting && !submissionUnconfirmed;
        refreshSlotsButton.setEnabled(canChoose);
        retrySlotsButton.setEnabled(canChoose);
        for (View button : dayButtons) button.setEnabled(canChoose);
        slotAdapter.setInteractionEnabled(canChoose);

        boolean validChoice = isSelectableSlot(selectedSlot);
        saveButton.setEnabled(canChoose && validChoice && !isNoChange());
        saveButton.setText(submitting ? R.string.edit_saving : R.string.edit_save);
        submitProgress.setVisibility(submitting ? View.VISIBLE : View.GONE);
        saveHint.setText(selectedSlot == null ? R.string.edit_select_slot_hint
                : isNoChange() ? R.string.edit_no_changes
                : R.string.edit_ready_hint);
    }

    private void saveChanges() {
        // Sends the immutable original station and the selected slot's raw startTime.
        if (submitting || !sessionReady || isSlotsLoading
                || selectedSlot == null
                || !isSelectableSlot(selectedSlot) || isNoChange()) return;

        hideUpdateError();
        submitting = true;
        updateActions();
        UpdateReservationRequest request = new UpdateReservationRequest(
                original.stationId, selectedSlot.slotId, selectedSlot.startTime);
        updateCall = NetworkManager.getInstance().getApiService()
                .updateReservation(original.reservationId, request);
        final Call<ApiResponse<ReservationData>> call = updateCall;
        call.enqueue(new Callback<ApiResponse<ReservationData>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<ReservationData>> requestCall,
                                   @NonNull Response<ApiResponse<ReservationData>> response) {
                if (isFinishing() || isDestroyed() || call != updateCall || call.isCanceled()) return;
                submitting = false;
                ApiResponse<ReservationData> body = response.body();
                if (response.isSuccessful() && body != null && body.success
                        && body.data != null && hasText(body.data.reservationId)) {
                    ReservationSummaryActivity.open(EditReservationActivity.this,
                            ReservationSummaryActivity.Action.UPDATE, body.data);
                    finish();
                } else {
                    updateActions();
                    showUpdateError(response.isSuccessful()
                            ? body != null && hasText(body.message) ? body.message
                            : getString(R.string.edit_incomplete_response)
                            : ApiErrorParser.getMessage(EditReservationActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<ReservationData>> requestCall,
                                  @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != updateCall || call.isCanceled()) return;
                submitting = false;
                updateActions();
                showUpdateError(getString(R.string.error_network));
            }
        });
    }

    private static boolean hasText(String text) {
        // Checks request and display fields without inventing missing values.
        return text != null && !text.trim().isEmpty();
    }

    private static Long parseApiTicks(String value) {
        // Preserves the API's seven fractional digits for rolling-window boundary checks.
        if (!hasText(value)) return null;
        Matcher match = API_TIMESTAMP.matcher(value.trim());
        if (!match.matches()) return null;
        String seconds = match.group(1) + (match.group(3) == null ? "Z" : match.group(3));
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US);
        format.setLenient(false);
        ParsePosition position = new ParsePosition(0);
        Date parsed = format.parse(seconds, position);
        if (parsed == null || position.getIndex() != seconds.length()) return null;
        String fraction = match.group(2);
        long fractionalTicks = fraction == null ? 0L
                : Long.parseLong((fraction + "0000000").substring(0, 7));
        try {
            return Math.addExact(
                    Math.multiplyExact(parsed.getTime(), TICKS_PER_MILLISECOND),
                    fractionalTicks);
        } catch (ArithmeticException invalidTimestamp) {
            return null;
        }
    }

    private int dp(int value) {
        // Converts date-chip dimensions into pixels for dynamic native views.
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}

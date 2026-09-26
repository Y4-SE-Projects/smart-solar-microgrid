// File: ManageSlotsActivity.java
// Purpose: Grid Operator slot management, mirroring the web slot page: pick a day or search the month, then switch slots on or off.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.IntentCompat;
import androidx.core.os.BundleCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat.AccessibilityActionCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.EnergyBookingSlot;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.models.SetSlotAvailabilityRequest;
import com.example.smart_solar_mobile.models.SolarStation;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.example.smart_solar_mobile.views.MonthCalendarView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.WeakHashMap;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ManageSlotsActivity extends AppCompatActivity {
    public static final String EXTRA_STATION = "station";
    public static final String RESULT_STATION_ID = "station_id";
    private static final String STATE_STATION = "station";
    private static final String STATE_SELECTED_DAY = "selected_day";
    private static final String STATE_CALENDAR_MONTH = "calendar_month";
    private static final String STATE_CALENDAR_VISIBLE = "calendar_visible";

    private final List<SolarStation> stations = new ArrayList<>();
    private SolarStation station;
    // Local midnight of the day whose slots are listed
    private Date selectedDay;
    // First day of the month shown on the calendar; it can differ from selectedDay's month
    private Date calendarMonth;
    private String query = "";
    // The calendar is tucked away until the operator asks for it
    private boolean calendarVisible;

    // Slots cached a month at a time, keyed "stationId|yyyy-MM". A key in none of these maps still needs loading.
    private final Map<String, List<EnergyBookingSlot>> monthSlots = new HashMap<>();
    private final Map<String, String> monthErrors = new HashMap<>();
    private final Map<String, Call<ApiResponse<List<EnergyBookingSlot>>>> monthCalls = new HashMap<>();
    // Parsed start/end times, so searching doesn't re-parse every slot on each keystroke
    private final Map<EnergyBookingSlot, Date> startTimes = new WeakHashMap<>();
    private final Map<EnergyBookingSlot, Date> endTimes = new WeakHashMap<>();

    private Call<ApiResponse<List<SolarStation>>> stationsCall;
    private Call<ApiResponse<EnergyBookingSlot>> availabilityCall;
    // The slot (by Mongo id) whose availability change is in flight, and the value it is changing to
    private String pendingSlotKey;
    private boolean pendingAvailable;
    private String actionError;

    private View stationSwitcher;
    private TextView headerStationText;
    private View stationsErrorBanner;
    private TextView stationsErrorText;
    private TextView deactivatedNotice;
    private View actionErrorBanner;
    private TextView actionErrorText;
    private View todayButton;
    private View calendarCard;
    private MaterialButton calendarToggleButton;
    private MonthCalendarView calendarView;
    private TextView legendText;
    private TextView monthStatusText;
    private TextInputEditText slotSearchInput;
    private TextView listTitleText;
    private TextView listCountText;
    private View slotsProgress;
    private View slotsErrorBanner;
    private TextView slotsErrorText;
    private View emptyState;
    private TextView emptyTitleText;
    private TextView emptyMessageText;
    private View clearSearchButton;
    private LinearLayout slotsContainer;

    public static Intent intentFor(Context context, SolarStation station) {
        // Builds the intent the operator console uses to open this screen for a station
        return new Intent(context, ManageSlotsActivity.class).putExtra(EXTRA_STATION, station);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Restores or starts on today in the given station, then checks the session and loads the slots
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_manage_slots);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.manageRoot));
        bindViews();

        Date today = TimeUtils.startOfDay(new Date());
        if (savedInstanceState != null) {
            station = BundleCompat.getSerializable(savedInstanceState, STATE_STATION, SolarStation.class);
            selectedDay = new Date(savedInstanceState.getLong(STATE_SELECTED_DAY, today.getTime()));
            calendarMonth = new Date(savedInstanceState.getLong(STATE_CALENDAR_MONTH, today.getTime()));
            calendarVisible = savedInstanceState.getBoolean(STATE_CALENDAR_VISIBLE, false);
        } else {
            station = IntentCompat.getSerializableExtra(getIntent(), EXTRA_STATION, SolarStation.class);
            selectedDay = today;
            calendarMonth = TimeUtils.startOfMonth(today);
        }
        if (station == null) {
            finish();
            return;
        }

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        stationSwitcher.setOnClickListener(v -> openStationPicker());
        ViewCompat.replaceAccessibilityAction(stationSwitcher, AccessibilityActionCompat.ACTION_CLICK,
                getString(R.string.change_station), null);
        findViewById(R.id.stationsRetryButton).setOnClickListener(v -> loadStations());
        findViewById(R.id.actionErrorDismissButton).setOnClickListener(v -> {
            actionError = null;
            render();
        });
        todayButton.setOnClickListener(v -> selectDay(new Date()));
        calendarToggleButton.setOnClickListener(v -> setCalendarVisible(!calendarVisible));
        setCalendarVisible(calendarVisible);
        monthStatusText.setOnClickListener(v -> retryMonth(TimeUtils.monthKey(calendarMonth)));
        findViewById(R.id.slotsRetryButton).setOnClickListener(v ->
                retryMonth(TimeUtils.monthKey(isSearching() ? calendarMonth : selectedDay)));
        clearSearchButton.setOnClickListener(v -> slotSearchInput.setText(""));
        calendarView.setListener(new MonthCalendarView.Listener() {
            @Override
            public void onDaySelected(Date day) {
                // A tapped day becomes the listed day
                selectDay(day);
            }

            @Override
            public void onMonthChanged(int monthDelta) {
                // The arrows only move the calendar; the listed day stays until another is tapped
                calendarMonth = TimeUtils.addMonths(calendarMonth, monthDelta);
                ensureMonthsLoaded();
                render();
            }
        });
        slotSearchInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
                // Not needed
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                // Searching filters the calendar month's slots on every keystroke, without a request
                query = s.toString();
                render();
            }

            @Override
            public void afterTextChanged(Editable s) {
                // Not needed
            }
        });

        showStation();
        render();

        // Checks the session here too, because Android can reopen the app straight onto this screen
        SessionManager.getInstance().loadSession(session -> {
            if (session == null || !Roles.GRID_OPERATOR.equals(session.role)) {
                Navigator.openLogin(this, false);
                return;
            }
            ensureMonthsLoaded();
            render();
            loadStations();
        });
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Keeps the station, listed day and calendar month across rotation (the search box keeps its own text)
        super.onSaveInstanceState(outState);
        outState.putSerializable(STATE_STATION, station);
        outState.putLong(STATE_SELECTED_DAY, selectedDay.getTime());
        outState.putLong(STATE_CALENDAR_MONTH, calendarMonth.getTime());
        outState.putBoolean(STATE_CALENDAR_VISIBLE, calendarVisible);
    }

    @Override
    protected void onDestroy() {
        // Stops every request still in flight so no reply touches a destroyed screen
        for (Call<ApiResponse<List<EnergyBookingSlot>>> call : monthCalls.values()) {
            call.cancel();
        }
        if (stationsCall != null) {
            stationsCall.cancel();
        }
        if (availabilityCall != null) {
            availabilityCall.cancel();
        }
        super.onDestroy();
    }

    private void bindViews() {
        // Looks up every view the screen updates
        stationSwitcher = findViewById(R.id.stationSwitcher);
        headerStationText = findViewById(R.id.headerStationText);
        stationsErrorBanner = findViewById(R.id.stationsErrorBanner);
        stationsErrorText = findViewById(R.id.stationsErrorText);
        deactivatedNotice = findViewById(R.id.deactivatedNotice);
        actionErrorBanner = findViewById(R.id.actionErrorBanner);
        actionErrorText = findViewById(R.id.actionErrorText);
        todayButton = findViewById(R.id.todayButton);
        calendarCard = findViewById(R.id.calendarCard);
        calendarToggleButton = findViewById(R.id.calendarToggleButton);
        calendarView = findViewById(R.id.calendarView);
        legendText = findViewById(R.id.legendText);
        monthStatusText = findViewById(R.id.monthStatusText);
        slotSearchInput = findViewById(R.id.slotSearchInput);
        listTitleText = findViewById(R.id.listTitleText);
        listCountText = findViewById(R.id.listCountText);
        slotsProgress = findViewById(R.id.slotsProgress);
        slotsErrorBanner = findViewById(R.id.slotsErrorBanner);
        slotsErrorText = findViewById(R.id.slotsErrorText);
        emptyState = findViewById(R.id.emptyState);
        emptyTitleText = findViewById(R.id.emptyTitleText);
        emptyMessageText = findViewById(R.id.emptyMessageText);
        clearSearchButton = findViewById(R.id.clearSearchButton);
        slotsContainer = findViewById(R.id.slotsContainer);
    }

    // ---- Station ----

    private void loadStations() {
        // Loads every station so the header can switch between them, like the web page's station dropdown
        stationsErrorBanner.setVisibility(View.GONE);
        if (stationsCall != null) {
            stationsCall.cancel();
        }
        stationsCall = NetworkManager.getInstance().getApiService().getStations();
        stationsCall.enqueue(new Callback<ApiResponse<List<SolarStation>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<SolarStation>>> call,
                                   @NonNull Response<ApiResponse<List<SolarStation>>> response) {
                // Refreshes the current station from the list (e.g. if it was deactivated since) and enables switching
                if (isFinishing() || isDestroyed() || call.isCanceled()) {
                    return;
                }
                ApiResponse<List<SolarStation>> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    stations.clear();
                    stations.addAll(body.data);
                    for (SolarStation candidate : stations) {
                        if (candidate.stationId.equals(station.stationId)) {
                            station = candidate;
                            break;
                        }
                    }
                    showStation();
                } else {
                    showStationsError(ApiErrorParser.getMessage(ManageSlotsActivity.this, response));
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

    private void showStationsError(String message) {
        // Explains why switching station isn't available; the current station's slots still work
        stationsErrorText.setText(message);
        stationsErrorBanner.setVisibility(View.VISIBLE);
    }

    private void showStation() {
        // Shows the station in the header and the deactivated notice, and reports it back to the console
        headerStationText.setText(getString(R.string.operator_header_station, station.stationId, station.name));
        boolean canSwitch = !stations.isEmpty();
        headerStationText.setCompoundDrawablesRelativeWithIntrinsicBounds(0, 0, canSwitch ? R.drawable.ic_expand_more : 0, 0);
        stationSwitcher.setEnabled(canSwitch);
        deactivatedNotice.setText(getString(R.string.station_deactivated_slots_notice, station.stationId));
        deactivatedNotice.setVisibility(station.isActive ? View.GONE : View.VISIBLE);
        setResult(RESULT_OK, new Intent().putExtra(RESULT_STATION_ID, station.stationId));
    }

    private void openStationPicker() {
        // Opens the same searchable picker as the console
        if (!stations.isEmpty()) {
            StationPickerDialog.show(this, stations, station.stationId, this::switchStation);
        }
    }

    private void switchStation(SolarStation newStation) {
        // Shows another station's slots for the same day; months already loaded for it come from the cache
        if (newStation.stationId.equals(station.stationId)) {
            return;
        }
        station = newStation;
        actionError = null;
        showStation();
        ensureMonthsLoaded();
        render();
    }

    // ---- Day, month and search ----

    private boolean isSearching() {
        // True while the search box has at least one word in it
        return searchWords().length > 0;
    }

    private String[] searchWords() {
        // The search text split into lowercase words
        String trimmed = query.trim().toLowerCase(Locale.getDefault());
        return trimmed.isEmpty() ? new String[0] : trimmed.split("\\s+");
    }

    private void setCalendarVisible(boolean visible) {
        // Shows or hides the calendar; the button stays filled while it is open
        calendarVisible = visible;
        calendarCard.setVisibility(visible ? View.VISIBLE : View.GONE);
        calendarToggleButton.setSelected(visible);
        calendarToggleButton.setContentDescription(getString(visible ? R.string.hide_calendar : R.string.show_calendar));
    }

    private void selectDay(Date day) {
        // Lists one day's slots and moves the calendar to its month; picking a day ends a search, as on the web page,
        // and closes the calendar so the day's slots are in view
        selectedDay = TimeUtils.startOfDay(day);
        calendarMonth = TimeUtils.startOfMonth(day);
        actionError = null;
        setCalendarVisible(false);
        if (!query.isEmpty()) {
            slotSearchInput.setText("");
        }
        ensureMonthsLoaded();
        render();
    }

    // ---- Loading ----

    private String cacheKey(String monthKey) {
        // Cache key for a month of the current station, e.g. "STN-001|2026-09"
        return station.stationId + "|" + monthKey;
    }

    private void ensureMonthsLoaded() {
        // Fetches the calendar's month and the listed day's month if they aren't cached or already loading
        for (String monthKey : new String[]{TimeUtils.monthKey(calendarMonth), TimeUtils.monthKey(selectedDay)}) {
            String key = cacheKey(monthKey);
            if (!monthSlots.containsKey(key) && !monthErrors.containsKey(key) && !monthCalls.containsKey(key)) {
                loadMonth(monthKey);
            }
        }
    }

    private void loadMonth(String monthKey) {
        // Fetches one month of the current station's slots; a newer request for the same month replaces this one
        String key = cacheKey(monthKey);
        Call<ApiResponse<List<EnergyBookingSlot>>> previous = monthCalls.remove(key);
        if (previous != null) {
            previous.cancel();
        }
        Call<ApiResponse<List<EnergyBookingSlot>>> call =
                NetworkManager.getInstance().getApiService().getStationSlots(station.stationId, monthKey);
        monthCalls.put(key, call);
        call.enqueue(new Callback<ApiResponse<List<EnergyBookingSlot>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> c,
                                   @NonNull Response<ApiResponse<List<EnergyBookingSlot>>> response) {
                // Caches the month, or its error, unless this request has been replaced
                if (isFinishing() || isDestroyed() || monthCalls.get(key) != call) {
                    return;
                }
                monthCalls.remove(key);
                ApiResponse<List<EnergyBookingSlot>> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    monthSlots.put(key, body.data);
                    monthErrors.remove(key);
                } else {
                    monthSlots.remove(key);
                    monthErrors.put(key, ApiErrorParser.getMessage(ManageSlotsActivity.this, response));
                }
                render();
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> c, @NonNull Throwable t) {
                // The request never reached the API
                if (isFinishing() || isDestroyed() || monthCalls.get(key) != call) {
                    return;
                }
                monthCalls.remove(key);
                monthSlots.remove(key);
                monthErrors.put(key, getString(R.string.error_network));
                render();
            }
        });
    }

    private void retryMonth(String monthKey) {
        // Forgets a month's error and asks for it again
        String key = cacheKey(monthKey);
        if (!monthErrors.containsKey(key)) {
            return;
        }
        monthErrors.remove(key);
        loadMonth(monthKey);
        render();
    }

    private void refreshShownMonths() {
        // After a change: reloads the months on screen (their rows stay until the new ones arrive) and forgets
        // this station's other months so they reload when visited, like the web page
        Set<String> shownKeys = new HashSet<>();
        shownKeys.add(cacheKey(TimeUtils.monthKey(calendarMonth)));
        shownKeys.add(cacheKey(TimeUtils.monthKey(selectedDay)));
        String prefix = station.stationId + "|";

        monthSlots.keySet().removeIf(key -> key.startsWith(prefix) && !shownKeys.contains(key));
        monthErrors.keySet().removeIf(key -> key.startsWith(prefix) && !shownKeys.contains(key));
        Iterator<Map.Entry<String, Call<ApiResponse<List<EnergyBookingSlot>>>>> calls = monthCalls.entrySet().iterator();
        while (calls.hasNext()) {
            Map.Entry<String, Call<ApiResponse<List<EnergyBookingSlot>>>> entry = calls.next();
            if (entry.getKey().startsWith(prefix) && !shownKeys.contains(entry.getKey())) {
                entry.getValue().cancel();
                calls.remove();
            }
        }

        loadMonth(TimeUtils.monthKey(calendarMonth));
        if (!TimeUtils.isSameLocalMonth(calendarMonth, selectedDay)) {
            loadMonth(TimeUtils.monthKey(selectedDay));
        }
    }

    // ---- Availability ----

    private void toggleAvailability(EnergyBookingSlot slot, boolean makeAvailable) {
        // Asks the API to switch the slot on or off; the API has the final say (409 while a reservation holds it)
        pendingSlotKey = slotKey(slot);
        pendingAvailable = makeAvailable;
        actionError = null;
        render();

        availabilityCall = NetworkManager.getInstance().getApiService()
                .setSlotAvailability(slot.slotId, new SetSlotAvailabilityRequest(makeAvailable));
        availabilityCall.enqueue(new Callback<ApiResponse<EnergyBookingSlot>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<EnergyBookingSlot>> call,
                                   @NonNull Response<ApiResponse<EnergyBookingSlot>> response) {
                // Keeps the new state on success, or shows the API's reason and puts the switch back
                if (isFinishing() || isDestroyed() || call.isCanceled()) {
                    return;
                }
                pendingSlotKey = null;
                ApiResponse<EnergyBookingSlot> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    applyUpdatedSlot(body.data);
                    refreshShownMonths();
                } else {
                    actionError = getString(R.string.action_error, slot.slotId,
                            ApiErrorParser.getMessage(ManageSlotsActivity.this, response));
                }
                render();
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<EnergyBookingSlot>> call, @NonNull Throwable t) {
                // The request never reached the API, so the slot is unchanged
                if (isFinishing() || isDestroyed() || call.isCanceled()) {
                    return;
                }
                pendingSlotKey = null;
                actionError = getString(R.string.action_error, slot.slotId, getString(R.string.error_network));
                render();
            }
        });
    }

    private void applyUpdatedSlot(EnergyBookingSlot updated) {
        // Copies the API's new availability into every cached copy of the slot, so the switch doesn't flicker back
        String updatedKey = slotKey(updated);
        for (List<EnergyBookingSlot> slots : monthSlots.values()) {
            for (EnergyBookingSlot slot : slots) {
                if (slotKey(slot).equals(updatedKey)) {
                    slot.isAvailable = updated.isAvailable;
                }
            }
        }
    }

    private static String slotKey(EnergyBookingSlot slot) {
        // Identifies a slot by its Mongo id, which (unlike slotId) never repeats
        return slot.id != null ? slot.id : slot.slotId;
    }

    // ---- Drawing ----

    private void render() {
        // Redraws the calendar, search hint, list heading and slot rows from the current state
        Date now = new Date();
        String[] words = searchWords();
        boolean searching = words.length > 0;
        String calendarKey = cacheKey(TimeUtils.monthKey(calendarMonth));
        String selectedKey = cacheKey(TimeUtils.monthKey(selectedDay));
        String calendarMonthName = TimeUtils.formatMonthName(calendarMonth);

        // The API pads each month by a day either side, so both months are trimmed back to local dates
        List<EnergyBookingSlot> calendarSlots = slotsInMonth(monthSlots.get(calendarKey), calendarMonth);
        List<EnergyBookingSlot> selectedMonthSlots = slotsInMonth(monthSlots.get(selectedKey), selectedDay);

        // While searching, the list covers the whole calendar month instead of one day
        List<EnergyBookingSlot> rows = new ArrayList<>();
        if (searching) {
            for (EnergyBookingSlot slot : calendarSlots) {
                if (matchesSlot(slot, words)) {
                    rows.add(slot);
                }
            }
        } else {
            for (EnergyBookingSlot slot : selectedMonthSlots) {
                if (TimeUtils.isSameLocalDay(startOf(slot), selectedDay)) {
                    rows.add(slot);
                }
            }
        }

        renderCalendar(searching ? rows : calendarSlots, searching, calendarKey, calendarMonthName, now);
        slotSearchInput.setHint(getString(R.string.search_month_slots, calendarMonthName));
        actionErrorText.setText(actionError);
        actionErrorBanner.setVisibility(actionError != null ? View.VISIBLE : View.GONE);

        String listKey = searching ? calendarKey : selectedKey;
        boolean hasData = monthSlots.containsKey(listKey);
        String listError = monthErrors.get(listKey);

        listTitleText.setText(searching
                ? getString(R.string.matches_in_month, TimeUtils.formatMonthYear(calendarMonth))
                : TimeUtils.formatLongDate(selectedDay));
        if (listError != null) {
            listCountText.setText("");
        } else if (!hasData) {
            listCountText.setText(R.string.loading);
        } else {
            listCountText.setText(getResources().getQuantityString(R.plurals.slot_count, rows.size(), rows.size()));
        }
        // The line loader covers both a month loading and an availability change being saved
        slotsProgress.setVisibility(monthCalls.containsKey(listKey) || pendingSlotKey != null ? View.VISIBLE : View.GONE);
        slotsErrorText.setText(listError);
        slotsErrorBanner.setVisibility(listError != null ? View.VISIBLE : View.GONE);

        boolean showEmpty = hasData && rows.isEmpty();
        emptyState.setVisibility(showEmpty ? View.VISIBLE : View.GONE);
        if (showEmpty) {
            if (searching) {
                emptyTitleText.setText(getString(R.string.empty_search_title, calendarMonthName, query.trim()));
                emptyMessageText.setText(R.string.empty_search_hint);
            } else {
                emptyTitleText.setText(getString(R.string.empty_day_title, TimeUtils.formatShortDate(selectedDay)));
                emptyMessageText.setText(selectedMonthSlots.isEmpty()
                        ? getString(R.string.empty_month_none, TimeUtils.formatMonthName(selectedDay))
                        : getString(R.string.empty_day_pick_highlighted));
            }
            clearSearchButton.setVisibility(searching ? View.VISIBLE : View.GONE);
        }

        slotsContainer.removeAllViews();
        if (hasData) {
            for (EnergyBookingSlot slot : rows) {
                slotsContainer.addView(buildSlotRow(slot, searching, now));
            }
        }
        slotsContainer.setVisibility(hasData && !rows.isEmpty() ? View.VISIBLE : View.GONE);
    }

    private void renderCalendar(List<EnergyBookingSlot> markedSlots, boolean searching, String calendarKey,
                                String calendarMonthName, Date now) {
        // Highlights days with slots (or with search matches) and shows the month's status under the calendar
        Set<String> markedDays = new HashSet<>();
        for (EnergyBookingSlot slot : markedSlots) {
            markedDays.add(TimeUtils.dayKey(startOf(slot)));
        }
        calendarView.render(calendarMonth, selectedDay, markedDays, searching);
        legendText.setText(searching ? R.string.legend_has_matches : R.string.legend_has_slots);

        boolean calendarFailed = monthErrors.containsKey(calendarKey);
        if (calendarFailed) {
            monthStatusText.setText(R.string.month_load_failed_retry);
        } else if (monthSlots.containsKey(calendarKey)) {
            monthStatusText.setText(getResources().getQuantityString(R.plurals.days_in_month,
                    markedDays.size(), markedDays.size(), calendarMonthName));
        } else {
            monthStatusText.setText(R.string.loading);
        }
        monthStatusText.setTextColor(ContextCompat.getColor(this, calendarFailed ? R.color.alert_danger : R.color.on_surface_variant));
        monthStatusText.setClickable(calendarFailed);

        // "Today" does nothing when today is already listed and on the calendar
        todayButton.setEnabled(searching || !TimeUtils.isSameLocalDay(selectedDay, now)
                || !TimeUtils.isSameLocalMonth(calendarMonth, selectedDay));
    }

    private View buildSlotRow(EnergyBookingSlot slot, boolean searching, Date now) {
        // Builds one row; while searching it also shows the slot's date and opens that day when tapped
        View row = getLayoutInflater().inflate(R.layout.item_manage_slot, slotsContainer, false);
        View textColumn = row.findViewById(R.id.slotTextColumn);
        TextView dateText = row.findViewById(R.id.slotDateText);
        TextView timeText = row.findViewById(R.id.slotTimeText);
        TextView metaText = row.findViewById(R.id.slotMetaText);
        TextView statusChip = row.findViewById(R.id.slotStatusChip);
        MaterialSwitch slotSwitch = row.findViewById(R.id.slotSwitch);

        Date start = startOf(slot);
        Date end = endOf(slot);
        String timeLabel = getString(R.string.slot_time_range, TimeUtils.formatTime(start), TimeUtils.formatTime(end));
        timeText.setText(timeLabel);
        metaText.setText(getString(R.string.slot_meta,
                TimeUtils.formatDuration(this, (end.getTime() - start.getTime()) / 60000), slot.slotId));

        // While a change is in flight the row shows the value it is changing to
        boolean pending = slotKey(slot).equals(pendingSlotKey);
        boolean available = pending ? pendingAvailable : slot.isAvailable;
        statusChip.setText(available ? R.string.slot_available : R.string.slot_unavailable);
        statusChip.setBackgroundResource(available ? R.drawable.bg_chip_active : R.drawable.bg_chip_neutral);
        statusChip.setTextColor(ContextCompat.getColor(this, available ? R.color.primary_container : R.color.on_surface_variant));

        slotSwitch.setChecked(available);
        slotSwitch.setEnabled(pendingSlotKey == null);
        slotSwitch.setContentDescription(getString(R.string.slot_toggle_description, timeLabel));
        slotSwitch.setOnClickListener(v -> toggleAvailability(slot, slotSwitch.isChecked()));

        // Slots that have already finished are dimmed, as on the console
        if (end.before(now)) {
            textColumn.setAlpha(0.55f);
        }

        if (searching) {
            dateText.setText(TimeUtils.formatShortDate(start));
            dateText.setVisibility(View.VISIBLE);
            TypedValue ripple = new TypedValue();
            getTheme().resolveAttribute(android.R.attr.selectableItemBackground, ripple, true);
            row.setForeground(ContextCompat.getDrawable(this, ripple.resourceId));
            row.setOnClickListener(v -> selectDay(start));
        }
        return row;
    }

    private List<EnergyBookingSlot> slotsInMonth(List<EnergyBookingSlot> slots, Date month) {
        // Keeps the slots that start in the given local month; slots with unreadable times are skipped
        List<EnergyBookingSlot> result = new ArrayList<>();
        if (slots == null) {
            return result;
        }
        for (EnergyBookingSlot slot : slots) {
            if (startOf(slot) != null && endOf(slot) != null && TimeUtils.isSameLocalMonth(startOf(slot), month)) {
                result.add(slot);
            }
        }
        return result;
    }

    private boolean matchesSlot(EnergyBookingSlot slot, String[] words) {
        // Same rules as the web page: each word must appear in the slot ID or start one of the slot's other words
        // (its times with and without the leading zero, weekday, month, day number, availability), so "available"
        // doesn't match "unavailable"
        Locale locale = Locale.getDefault();
        Date start = startOf(slot);
        Date end = endOf(slot);
        String startTime = TimeUtils.formatTime(start);
        String endTime = TimeUtils.formatTime(end);
        String[] tokens = {
                startTime,
                endTime,
                startTime.replaceFirst("^0", ""),
                endTime.replaceFirst("^0", ""),
                TimeUtils.formatWeekday(start).toLowerCase(locale),
                TimeUtils.formatMonthName(start).toLowerCase(locale),
                String.valueOf(TimeUtils.dayOfMonth(start)),
                getString(slot.isAvailable ? R.string.search_word_available : R.string.search_word_unavailable),
        };
        String id = slot.slotId.toLowerCase(locale);

        for (String word : words) {
            if (id.contains(word)) {
                continue;
            }
            boolean found = false;
            for (String token : tokens) {
                if (token.startsWith(word)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }
        return true;
    }

    private Date startOf(EnergyBookingSlot slot) {
        // The slot's start time, parsed once
        Date start = startTimes.get(slot);
        if (start == null) {
            start = TimeUtils.parseApiDate(slot.startTime);
            startTimes.put(slot, start);
        }
        return start;
    }

    private Date endOf(EnergyBookingSlot slot) {
        // The slot's end time, parsed once
        Date end = endTimes.get(slot);
        if (end == null) {
            end = TimeUtils.parseApiDate(slot.endTime);
            endTimes.put(slot, end);
        }
        return end;
    }
}

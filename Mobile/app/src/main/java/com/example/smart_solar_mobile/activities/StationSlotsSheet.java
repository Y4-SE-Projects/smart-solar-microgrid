// File: StationSlotsSheet.java
// Purpose: Station popup on the map: the station's details and its upcoming slots from GET /api/stations/{stationId}/slots?upcomingOnly=true.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.models.EnergyBookingSlot;
import com.example.smart_solar_mobile.models.SolarStation;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;

import java.text.DecimalFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class StationSlotsSheet {
    private static final DecimalFormat CAPACITY_FORMAT = new DecimalFormat("0.##");

    private final AppCompatActivity activity;
    private final SolarStation station;
    private final BottomSheetDialog dialog;
    private final View progress;
    private final View errorBanner;
    private final TextView errorText;
    private final TextView emptyText;
    private final TextView openCountText;
    private final LinearLayout slotsContainer;
    private Call<ApiResponse<List<EnergyBookingSlot>>> slotsCall;

    public StationSlotsSheet(AppCompatActivity activity, SolarStation station, String distanceLabel) {
        // Builds the popup and fills in the station details the map already has
        this.activity = activity;
        this.station = station;
        dialog = new BottomSheetDialog(activity);
        dialog.setContentView(R.layout.bottom_sheet_station_slots);

        progress = dialog.findViewById(R.id.sheetProgress);
        errorBanner = dialog.findViewById(R.id.sheetErrorBanner);
        errorText = dialog.findViewById(R.id.sheetErrorText);
        emptyText = dialog.findViewById(R.id.sheetEmptyText);
        openCountText = dialog.findViewById(R.id.sheetOpenCountText);
        slotsContainer = dialog.findViewById(R.id.sheetSlotsContainer);

        TextView nameText = dialog.findViewById(R.id.sheetStationName);
        TextView metaText = dialog.findViewById(R.id.sheetStationMeta);
        TextView hoursText = dialog.findViewById(R.id.sheetHoursText);
        TextView capacityText = dialog.findViewById(R.id.sheetCapacityText);
        TextView batteryText = dialog.findViewById(R.id.sheetBatteryText);
        nameText.setText(station.name);
        metaText.setText(activity.getString(R.string.station_meta, station.stationId, distanceLabel));
        hoursText.setText(station.schedule);
        capacityText.setText(activity.getString(R.string.station_capacity_value, CAPACITY_FORMAT.format(station.capacityKWh)));
        batteryText.setText(String.valueOf(station.batterySlotCount));

        dialog.findViewById(R.id.sheetRetryButton).setOnClickListener(v -> loadSlots());
        dialog.setOnDismissListener(d -> {
            if (slotsCall != null) {
                slotsCall.cancel();
            }
        });
        dialog.getBehavior().setState(BottomSheetBehavior.STATE_EXPANDED);
        dialog.getBehavior().setSkipCollapsed(true);
    }

    public void show() {
        // Opens the popup and starts loading the slots
        dialog.show();
        loadSlots();
    }

    private void loadSlots() {
        // Asks the API for the station's upcoming slots; the API decides which slots are still open for booking
        progress.setVisibility(View.VISIBLE);
        errorBanner.setVisibility(View.GONE);
        emptyText.setVisibility(View.GONE);
        if (slotsCall != null) {
            slotsCall.cancel();
        }
        Call<ApiResponse<List<EnergyBookingSlot>>> call =
                NetworkManager.getInstance().getApiService().getUpcomingSlots(station.stationId);
        slotsCall = call;
        call.enqueue(new Callback<ApiResponse<List<EnergyBookingSlot>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> c,
                                   @NonNull Response<ApiResponse<List<EnergyBookingSlot>>> response) {
                // Shows the slots, or the API's reason for failing
                if (isGone(call)) {
                    return;
                }
                progress.setVisibility(View.GONE);
                ApiResponse<List<EnergyBookingSlot>> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    showSlots(body.data);
                } else {
                    showError(ApiErrorParser.getMessage(activity, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<EnergyBookingSlot>>> c, @NonNull Throwable t) {
                // The request never reached the API
                if (isGone(call)) {
                    return;
                }
                progress.setVisibility(View.GONE);
                showError(activity.getString(R.string.error_network));
            }
        });
    }

    private boolean isGone(Call<?> call) {
        // True when the reply is no longer wanted: the popup closed, the request was replaced, or the screen went away
        return !dialog.isShowing() || call.isCanceled() || call != slotsCall
                || activity.isFinishing() || activity.isDestroyed();
    }

    private void showError(String message) {
        // Shows why the slots couldn't load, with a Retry button
        errorText.setText(message);
        errorBanner.setVisibility(View.VISIBLE);
    }

    private void showSlots(List<EnergyBookingSlot> slots) {
        // Groups the slots by local day under "Today", "Tomorrow" or the date, and counts how many are open
        slotsContainer.removeAllViews();
        int openCount = 0;
        for (EnergyBookingSlot slot : slots) {
            if (slot.isAvailable) {
                openCount++;
            }
        }
        openCountText.setText(slots.isEmpty() ? "" : activity.getString(R.string.slots_open_count, openCount, slots.size()));
        emptyText.setVisibility(slots.isEmpty() ? View.VISIBLE : View.GONE);

        LayoutInflater inflater = LayoutInflater.from(activity);
        Date now = new Date();
        String currentDay = null;
        LinearLayout dayCard = null;
        for (EnergyBookingSlot slot : slots) {
            Date start = TimeUtils.parseApiDate(slot.startTime);
            Date end = TimeUtils.parseApiDate(slot.endTime);
            if (start == null || end == null) {
                continue;
            }
            String dayKey = TimeUtils.dayKey(start);
            if (!dayKey.equals(currentDay)) {
                currentDay = dayKey;
                View dayGroup = inflater.inflate(R.layout.item_slot_day, slotsContainer, false);
                TextView header = dayGroup.findViewById(R.id.dayHeaderText);
                header.setText(dayLabel(start, now));
                dayCard = dayGroup.findViewById(R.id.daySlotsCard);
                slotsContainer.addView(dayGroup);
            }
            dayCard.addView(buildSlotRow(inflater, dayCard, slot, start, end));
        }
    }

    private String dayLabel(Date day, Date now) {
        // "Today", "Tomorrow", or a short date such as "Mon, 29 Sep"
        Calendar tomorrow = Calendar.getInstance();
        tomorrow.setTime(now);
        tomorrow.add(Calendar.DAY_OF_MONTH, 1);
        if (TimeUtils.isSameLocalDay(day, now)) {
            return activity.getString(R.string.today);
        }
        if (TimeUtils.isSameLocalDay(day, tomorrow.getTime())) {
            return activity.getString(R.string.tomorrow);
        }
        return TimeUtils.formatShortDate(day);
    }

    private View buildSlotRow(LayoutInflater inflater, LinearLayout parent, EnergyBookingSlot slot, Date start, Date end) {
        // One slot row: local time window, length and whether it can still be booked
        View row = inflater.inflate(R.layout.item_today_slot, parent, false);
        TextView timeText = row.findViewById(R.id.slotTimeText);
        TextView durationText = row.findViewById(R.id.slotDurationText);
        TextView statusChip = row.findViewById(R.id.slotStatusChip);

        timeText.setText(activity.getString(R.string.slot_time_range, TimeUtils.formatTime(start), TimeUtils.formatTime(end)));
        durationText.setText(TimeUtils.formatDuration(activity, (end.getTime() - start.getTime()) / 60000));
        statusChip.setText(slot.isAvailable ? R.string.slot_available : R.string.slot_unavailable);
        statusChip.setBackgroundResource(slot.isAvailable ? R.drawable.bg_chip_active : R.drawable.bg_chip_neutral);
        statusChip.setTextColor(ContextCompat.getColor(activity,
                slot.isAvailable ? R.color.primary_container : R.color.on_surface_variant));
        return row;
    }
}

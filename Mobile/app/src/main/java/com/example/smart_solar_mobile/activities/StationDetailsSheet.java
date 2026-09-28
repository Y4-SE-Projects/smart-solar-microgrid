// File: StationDetailsSheet.java
// Purpose: Station popup on the map: the station's details and a "Reserve a slot" button that opens Create Reservation for it.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.models.SolarStation;
import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;

import java.text.DecimalFormat;

public class StationDetailsSheet {
    private static final DecimalFormat CAPACITY_FORMAT = new DecimalFormat("0.##");

    private final BottomSheetDialog dialog;

    public StationDetailsSheet(AppCompatActivity activity, SolarStation station, String distanceLabel) {
        // Builds the popup from the station the map already has
        dialog = new BottomSheetDialog(activity);
        dialog.setContentView(R.layout.bottom_sheet_station_details);

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

        dialog.findViewById(R.id.reserveSlotButton).setOnClickListener(v -> {
            dialog.dismiss();
            activity.startActivity(CreateReservationActivity.intentFor(activity, station));
        });
        dialog.getBehavior().setState(BottomSheetBehavior.STATE_EXPANDED);
        dialog.getBehavior().setSkipCollapsed(true);
    }

    public void show() {
        // Opens the popup
        dialog.show();
    }
}

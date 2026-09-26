// File: StationPickerDialog.java
// Purpose: Bottom sheet for choosing a station, with a search field over the list.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.content.Context;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.TextView;

import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.adapters.StationAdapter;
import com.example.smart_solar_mobile.models.SolarStation;
import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.textfield.TextInputEditText;

import java.util.List;

public final class StationPickerDialog {

    // Receives the station the user picked
    public interface OnStationSelected {
        void onSelected(SolarStation station);
    }

    private StationPickerDialog() {
        // Static helper only, never instantiated
    }

    public static void show(Context context, List<SolarStation> stations, String selectedStationId,
                            OnStationSelected listener) {
        // Opens the picker with every station listed and the current one ticked
        BottomSheetDialog dialog = new BottomSheetDialog(context);
        dialog.setContentView(R.layout.bottom_sheet_station_picker);

        RecyclerView list = dialog.findViewById(R.id.stationPickerList);
        TextView emptyText = dialog.findViewById(R.id.stationPickerEmpty);
        TextInputEditText searchInput = dialog.findViewById(R.id.stationSearchInput);

        StationAdapter adapter = new StationAdapter(stations, selectedStationId, station -> {
            dialog.dismiss();
            listener.onSelected(station);
        });
        list.setLayoutManager(new LinearLayoutManager(context));
        list.setAdapter(adapter);

        searchInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
                // Not needed
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                // Filters the list on every keystroke
                adapter.filter(s.toString());
                emptyText.setVisibility(adapter.getItemCount() == 0 ? View.VISIBLE : View.GONE);
            }

            @Override
            public void afterTextChanged(Editable s) {
                // Not needed
            }
        });

        // Opens fully so the search field sits at the top (Material's sheet theme already resizes for the keyboard)
        dialog.getBehavior().setState(BottomSheetBehavior.STATE_EXPANDED);
        dialog.getBehavior().setSkipCollapsed(true);
        dialog.show();
    }
}

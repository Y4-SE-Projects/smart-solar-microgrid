// File: StationAdapter.java
// Purpose: RecyclerView adapter for the station picker, with search by station ID or name.
// Author: IT23215856

package com.example.smart_solar_mobile.adapters;

import android.annotation.SuppressLint;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.models.SolarStation;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class StationAdapter extends RecyclerView.Adapter<StationAdapter.StationViewHolder> {

    // Called when the user taps a station
    public interface OnStationClick {
        void onClick(SolarStation station);
    }

    private final List<SolarStation> allStations;
    private final List<SolarStation> visibleStations = new ArrayList<>();
    private final String selectedStationId;
    private final OnStationClick listener;

    public StationAdapter(List<SolarStation> stations, String selectedStationId, OnStationClick listener) {
        // Starts with every station visible
        this.allStations = new ArrayList<>(stations);
        this.selectedStationId = selectedStationId;
        this.listener = listener;
        visibleStations.addAll(allStations);
    }

    // A new search can change every row, so a full refresh is the right call here
    @SuppressLint("NotifyDataSetChanged")
    public void filter(String query) {
        // Keeps stations whose ID or name contains every typed word, ignoring case
        String[] words = query.trim().toLowerCase(Locale.getDefault()).split("\\s+");
        visibleStations.clear();
        for (SolarStation station : allStations) {
            String searchable = (station.stationId + " " + station.name).toLowerCase(Locale.getDefault());
            boolean matches = true;
            for (String word : words) {
                if (!word.isEmpty() && !searchable.contains(word)) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                visibleStations.add(station);
            }
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public StationViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        // Inflates one station row
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_station_option, parent, false);
        return new StationViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull StationViewHolder holder, int position) {
        // Fills a row with the station's name, ID, hours and state
        SolarStation station = visibleStations.get(position);
        holder.nameText.setText(station.name);
        holder.metaText.setText(holder.itemView.getContext()
                .getString(R.string.station_meta, station.stationId, station.schedule));
        holder.deactivatedChip.setVisibility(station.isActive ? View.GONE : View.VISIBLE);
        boolean selected = station.stationId.equals(selectedStationId);
        holder.selectedIcon.setVisibility(selected ? View.VISIBLE : View.INVISIBLE);
        holder.itemView.setSelected(selected);
        holder.itemView.setOnClickListener(v -> listener.onClick(station));
    }

    @Override
    public int getItemCount() {
        // Number of stations matching the current search
        return visibleStations.size();
    }

    static class StationViewHolder extends RecyclerView.ViewHolder {
        final TextView nameText;
        final TextView metaText;
        final TextView deactivatedChip;
        final ImageView selectedIcon;

        StationViewHolder(View itemView) {
            // Looks up the row's views once
            super(itemView);
            nameText = itemView.findViewById(R.id.optionNameText);
            metaText = itemView.findViewById(R.id.optionMetaText);
            deactivatedChip = itemView.findViewById(R.id.optionDeactivatedChip);
            selectedIcon = itemView.findViewById(R.id.optionSelectedIcon);
        }
    }
}

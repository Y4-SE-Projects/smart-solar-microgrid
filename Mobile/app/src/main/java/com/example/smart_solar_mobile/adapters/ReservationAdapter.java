// File: ReservationAdapter.java
// Purpose: RecyclerView adapter for the Prosumer's reservation history, with an in-memory status filter.

package com.example.smart_solar_mobile.adapters;

import android.annotation.SuppressLint;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.utils.ReservationStatusUi;
import com.example.smart_solar_mobile.utils.TimeUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class ReservationAdapter extends RecyclerView.Adapter<ReservationAdapter.ReservationViewHolder> {

    // Called when the user taps a reservation row
    public interface OnReservationClick {
        void onClick(ReservationData reservation);
    }

    private final List<ReservationData> allReservations = new ArrayList<>();
    private final List<ReservationData> visibleReservations = new ArrayList<>();
    private final OnReservationClick listener;
    private String statusFilter; // null shows every status
    private String searchQuery = "";

    public ReservationAdapter(OnReservationClick listener) {
        this.listener = listener;
    }

    // Replaces the full reservation list, keeping the current status filter applied
    @SuppressLint("NotifyDataSetChanged")
    public void setReservations(List<ReservationData> reservations) {
        allReservations.clear();
        allReservations.addAll(reservations);
        applyFilter();
    }

    // Pass null to show every status again
    @SuppressLint("NotifyDataSetChanged")
    public void setStatusFilter(String status) {
        this.statusFilter = status;
        applyFilter();
    }

    public void setSearchQuery(String query) {
        // The same filter applies to live and cached display rows.
        searchQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        applyFilter();
    }

    private void applyFilter() {
        visibleReservations.clear();
        for (ReservationData reservation : allReservations) {
            if ((statusFilter == null || statusFilter.equalsIgnoreCase(reservation.status))
                    && (searchQuery.isEmpty() || matchesSearch(reservation))) {
                visibleReservations.add(reservation);
            }
        }
        notifyDataSetChanged();
    }

    private boolean matchesSearch(ReservationData reservation) {
        return contains(reservation.reservationId) || contains(reservation.stationId)
                || contains(reservation.slotId) || contains(reservation.status)
                || contains(reservation.scheduledTime);
    }

    private boolean contains(String value) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(searchQuery);
    }

    public boolean isEmpty() {
        return visibleReservations.isEmpty();
    }

    public boolean hasAnyReservations() {
        return !allReservations.isEmpty();
    }

    @NonNull
    @Override
    public ReservationViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_reservation, parent, false);
        return new ReservationViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ReservationViewHolder holder, int position) {
        ReservationData reservation = visibleReservations.get(position);
        holder.idText.setText(reservation.reservationId);
        holder.metaText.setText(reservation.stationId);

        Date scheduled = TimeUtils.parseApiDate(reservation.scheduledTime);
        holder.timeText.setText(scheduled == null
                ? holder.itemView.getContext().getString(R.string.metric_empty)
                : holder.itemView.getContext().getString(R.string.history_item_meta,
                        TimeUtils.formatShortDate(scheduled), TimeUtils.formatTime(scheduled)));

        holder.statusChip.setBackgroundResource(ReservationStatusUi.chipBackground(reservation.status));
        holder.statusChip.setTextColor(ContextCompat.getColor(
                holder.statusChip.getContext(), ReservationStatusUi.chipTextColor(reservation.status)));
        holder.statusChip.setText(ReservationStatusUi.chipLabel(reservation.status));

        holder.itemView.setOnClickListener(v -> listener.onClick(reservation));
    }

    @Override
    public int getItemCount() {
        return visibleReservations.size();
    }

    static class ReservationViewHolder extends RecyclerView.ViewHolder {
        final TextView idText;
        final TextView metaText;
        final TextView timeText;
        final TextView statusChip;

        ReservationViewHolder(View itemView) {
            super(itemView);
            idText = itemView.findViewById(R.id.reservationIdText);
            metaText = itemView.findViewById(R.id.reservationMetaText);
            timeText = itemView.findViewById(R.id.reservationTimeText);
            statusChip = itemView.findViewById(R.id.reservationStatusChip);
        }
    }
}

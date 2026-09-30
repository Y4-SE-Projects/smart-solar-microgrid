// File: PendingReservationAdapter.java
// Purpose: Booking-focused cards for the Member 03 Prosumer Pending list.

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
import com.google.android.material.button.MaterialButton;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class PendingReservationAdapter
        extends RecyclerView.Adapter<PendingReservationAdapter.PendingViewHolder> {

    public interface OnEditClick {
        void onEdit(ReservationData reservation);
    }

    public interface OnCancelClick {
        void onCancel(ReservationData reservation);
    }

    private final List<ReservationData> reservations = new ArrayList<>();
    private final OnEditClick editListener;
    private final OnCancelClick cancelListener;

    public PendingReservationAdapter(@NonNull OnEditClick editListener,
                                     @NonNull OnCancelClick cancelListener) {
        // Keeps lifecycle navigation in the Member 03 screen rather than inside the adapter.
        this.editListener = editListener;
        this.cancelListener = cancelListener;
    }

    @SuppressLint("NotifyDataSetChanged")
    public void setReservations(@NonNull List<ReservationData> items) {
        // Keeps the API's order and excludes only malformed null entries.
        reservations.clear();
        for (ReservationData item : items) {
            if (item != null) reservations.add(item);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public PendingViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        // Inflates a Member 03 card without changing Member 04 history rows.
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_pending_reservation, parent, false);
        return new PendingViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull PendingViewHolder holder, int position) {
        // Shows only values returned by the Pending endpoint, with local time for presentation.
        ReservationData reservation = reservations.get(position);
        Date scheduled = TimeUtils.parseApiDate(reservation.scheduledTime);
        if (scheduled != null) {
            holder.dateText.setText(TimeUtils.formatLongDate(scheduled));
            holder.timeText.setText(TimeUtils.formatTime(scheduled));
            holder.timeText.setVisibility(View.VISIBLE);
        } else if (hasText(reservation.scheduledTime)) {
            holder.dateText.setText(reservation.scheduledTime);
            holder.timeText.setVisibility(View.GONE);
        } else {
            holder.dateText.setText(R.string.pending_schedule_unavailable);
            holder.timeText.setVisibility(View.GONE);
        }

        showValue(holder.stationRow, holder.stationText, reservation.stationId);
        showValue(holder.slotRow, holder.slotText, reservation.slotId);
        showValue(holder.referenceRow, holder.referenceText, reservation.reservationId);

        if (hasText(reservation.status)) {
            if (isKnownStatus(reservation.status)) {
                holder.statusChip.setText(ReservationStatusUi.chipLabel(reservation.status));
                holder.statusChip.setBackgroundResource(
                        ReservationStatusUi.chipBackground(reservation.status));
                holder.statusChip.setTextColor(ContextCompat.getColor(
                        holder.itemView.getContext(),
                        ReservationStatusUi.chipTextColor(reservation.status)));
            } else {
                holder.statusChip.setText(reservation.status);
                holder.statusChip.setBackgroundResource(R.drawable.bg_chip_neutral);
                holder.statusChip.setTextColor(ContextCompat.getColor(
                        holder.itemView.getContext(), R.color.on_surface_variant));
            }
            holder.statusChip.setVisibility(View.VISIBLE);
        } else {
            holder.statusChip.setVisibility(View.GONE);
        }

        boolean pending = "Pending".equalsIgnoreCase(reservation.status);
        holder.editButton.setVisibility(pending ? View.VISIBLE : View.GONE);
        if (pending) {
            holder.editButton.setOnClickListener(view -> editListener.onEdit(reservation));
        } else {
            holder.editButton.setOnClickListener(null);
        }
        boolean canCancel = pending && hasText(reservation.reservationId)
                && hasText(reservation.stationId) && hasText(reservation.slotId)
                && hasText(reservation.scheduledTime);
        holder.cancelButton.setVisibility(canCancel ? View.VISIBLE : View.GONE);
        holder.cancelButton.setOnClickListener(canCancel
                ? view -> cancelListener.onCancel(reservation) : null);
    }

    @Override
    public int getItemCount() {
        // Reports the number of real, non-null server records displayed.
        return reservations.size();
    }

    private static void showValue(View row, TextView text, String value) {
        // Hides absent API fields instead of inserting made-up station or slot details.
        boolean visible = hasText(value);
        row.setVisibility(visible ? View.VISIBLE : View.GONE);
        if (visible) text.setText(value);
    }

    private static boolean hasText(String value) {
        // Checks whether an API field contains displayable text.
        return value != null && !value.trim().isEmpty();
    }

    private static boolean isKnownStatus(String status) {
        // Prevents an unknown API status from being relabelled as Pending by the shared helper.
        return "Pending".equalsIgnoreCase(status)
                || "Approved".equalsIgnoreCase(status)
                || "Completed".equalsIgnoreCase(status)
                || "Cancelled".equalsIgnoreCase(status)
                || "Declined".equalsIgnoreCase(status);
    }

    static class PendingViewHolder extends RecyclerView.ViewHolder {
        final TextView dateText;
        final TextView timeText;
        final TextView statusChip;
        final View stationRow;
        final TextView stationText;
        final View slotRow;
        final TextView slotText;
        final View referenceRow;
        final TextView referenceText;
        final MaterialButton editButton;
        final MaterialButton cancelButton;

        PendingViewHolder(@NonNull View itemView) {
            super(itemView);
            dateText = itemView.findViewById(R.id.pendingItemDate);
            timeText = itemView.findViewById(R.id.pendingItemTime);
            statusChip = itemView.findViewById(R.id.pendingItemStatus);
            stationRow = itemView.findViewById(R.id.pendingItemStationRow);
            stationText = itemView.findViewById(R.id.pendingItemStation);
            slotRow = itemView.findViewById(R.id.pendingItemSlotRow);
            slotText = itemView.findViewById(R.id.pendingItemSlot);
            referenceRow = itemView.findViewById(R.id.pendingItemReferenceRow);
            referenceText = itemView.findViewById(R.id.pendingItemReference);
            editButton = itemView.findViewById(R.id.pendingItemEditButton);
            cancelButton = itemView.findViewById(R.id.pendingItemCancelButton);
        }
    }
}

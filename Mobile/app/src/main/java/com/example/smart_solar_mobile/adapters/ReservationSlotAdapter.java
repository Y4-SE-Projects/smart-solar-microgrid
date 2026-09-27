// File: ReservationSlotAdapter.java
// Purpose: Displays available reservation slots with a clear selected state.

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
import com.example.smart_solar_mobile.models.EnergyBookingSlot;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.google.android.material.card.MaterialCardView;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class ReservationSlotAdapter
        extends RecyclerView.Adapter<ReservationSlotAdapter.SlotHolder> {

    public interface OnSlotSelected {
        void onSelected(EnergyBookingSlot slot);
    }

    private final List<EnergyBookingSlot> slots = new ArrayList<>();
    private final OnSlotSelected listener;
    private String selectedSlotId;
    private boolean interactionEnabled = true;

    public ReservationSlotAdapter(OnSlotSelected listener) {
        // Uses the Activity callback without owning reservation or station logic.
        this.listener = listener;
    }

    @SuppressLint("NotifyDataSetChanged")
    public void setSlots(List<EnergyBookingSlot> newSlots, String selectedId) {
        // Replaces the displayed live slot list after an API response.
        slots.clear();
        slots.addAll(newSlots);
        selectedSlotId = selectedId;
        notifyDataSetChanged();
    }

    @SuppressLint("NotifyDataSetChanged")
    public void setSelectedSlotId(String slotId) {
        // Highlights the user's current choice.
        selectedSlotId = slotId;
        notifyDataSetChanged();
    }

    @SuppressLint("NotifyDataSetChanged")
    public void setInteractionEnabled(boolean enabled) {
        // Locks selection only while loading, submitting, or showing a confirmed result.
        if (interactionEnabled != enabled) {
            interactionEnabled = enabled;
            notifyDataSetChanged();
        }
    }

    @NonNull
    @Override
    public SlotHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        // Inflates one booking-focused slot card.
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_reservation_slot, parent, false);
        return new SlotHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull SlotHolder holder, int position) {
        // Shows API times locally while retaining the original timestamp in the model.
        EnergyBookingSlot slot = slots.get(position);
        Date start = TimeUtils.parseApiDate(slot.startTime);
        Date end = TimeUtils.parseApiDate(slot.endTime);
        if (start == null || end == null) return;

        String date = TimeUtils.formatLongDate(start);
        String time = holder.itemView.getContext().getString(R.string.slot_time_range,
                TimeUtils.formatTime(start), TimeUtils.formatTime(end));
        boolean selected = slot.slotId.equals(selectedSlotId);

        holder.dateText.setText(date);
        holder.timeText.setText(time);
        holder.slotIdText.setText(holder.itemView.getContext().getString(
                R.string.reservation_slot_id, slot.slotId));
        holder.selectedText.setVisibility(selected ? View.VISIBLE : View.GONE);
        holder.card.setStrokeColor(ContextCompat.getColor(holder.itemView.getContext(),
                selected ? R.color.secondary : R.color.border_slate));
        holder.card.setStrokeWidth(Math.round(
                (selected ? 2 : 1) * holder.itemView.getResources().getDisplayMetrics().density));
        holder.card.setCardBackgroundColor(ContextCompat.getColor(holder.itemView.getContext(),
                selected ? R.color.surface_container_low : R.color.surface_container_lowest));
        holder.card.setEnabled(interactionEnabled);
        holder.card.setAlpha(interactionEnabled ? 1f : 0.65f);
        holder.card.setContentDescription(holder.itemView.getContext().getString(
                R.string.reservation_slot_description, date, time, slot.slotId,
                holder.itemView.getContext().getString(selected
                        ? R.string.reservation_selected : R.string.slot_available)));
        holder.card.setOnClickListener(v -> {
            if (interactionEnabled) listener.onSelected(slot);
        });
    }

    @Override
    public int getItemCount() {
        // Returns the number of selectable live slots.
        return slots.size();
    }

    static class SlotHolder extends RecyclerView.ViewHolder {
        final MaterialCardView card;
        final TextView dateText;
        final TextView timeText;
        final TextView slotIdText;
        final TextView selectedText;

        SlotHolder(View itemView) {
            // Resolves the card's text and selection views.
            super(itemView);
            card = (MaterialCardView) itemView;
            dateText = itemView.findViewById(R.id.reservationSlotDate);
            timeText = itemView.findViewById(R.id.reservationSlotTime);
            slotIdText = itemView.findViewById(R.id.reservationSlotId);
            selectedText = itemView.findViewById(R.id.reservationSlotSelected);
        }
    }
}
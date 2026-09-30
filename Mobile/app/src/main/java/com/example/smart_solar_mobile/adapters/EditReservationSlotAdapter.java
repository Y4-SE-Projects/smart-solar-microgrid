// File: EditReservationSlotAdapter.java
// Purpose: Displays the owned current slot and available replacement slots for Member 03 editing.

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

public class EditReservationSlotAdapter
        extends RecyclerView.Adapter<EditReservationSlotAdapter.SlotHolder> {

    public interface OnSlotSelected {
        void onSelected(EnergyBookingSlot slot);
    }

    private final List<EnergyBookingSlot> slots = new ArrayList<>();
    private final OnSlotSelected listener;
    private String currentStationId;
    private String currentSlotId;
    private String selectedSlotId;
    private boolean enabled = true;

    public EditReservationSlotAdapter(@NonNull OnSlotSelected listener) {
        // Delegates selection to the owning Edit Activity.
        this.listener = listener;
    }

    @SuppressLint("NotifyDataSetChanged")
    public void setSlots(@NonNull List<EnergyBookingSlot> items, String stationId,
                         String currentStationId, String currentSlotId, String selectedSlotId) {
        // Renders only the Activity's already eligible live slot choices.
        slots.clear();
        slots.addAll(items);
        this.currentStationId = stationId != null && stationId.equals(currentStationId)
                ? currentStationId : null;
        this.currentSlotId = currentSlotId;
        this.selectedSlotId = selectedSlotId;
        notifyDataSetChanged();
    }

    @SuppressLint("NotifyDataSetChanged")
    public void setSelectedSlotId(String slotId) {
        // Updates the visible selected treatment without changing server state.
        selectedSlotId = slotId;
        notifyDataSetChanged();
    }

    @SuppressLint("NotifyDataSetChanged")
    public void setInteractionEnabled(boolean enabled) {
        // Locks slot taps during loading or PUT submission.
        if (this.enabled != enabled) {
            this.enabled = enabled;
            notifyDataSetChanged();
        }
    }

    @NonNull
    @Override
    public SlotHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        // Inflates the edit-specific current/available slot card.
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_edit_reservation_slot, parent, false);
        return new SlotHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull SlotHolder holder, int position) {
        // Uses local display time but retains the original API startTime in the selected model.
        EnergyBookingSlot slot = slots.get(position);
        Date start = TimeUtils.parseApiDate(slot.startTime);
        Date end = TimeUtils.parseApiDate(slot.endTime);
        if (start == null || end == null) return;
        boolean current = currentStationId != null
                && currentStationId.equals(slot.stationId)
                && slot.slotId.equals(currentSlotId);
        boolean selected = slot.slotId.equals(selectedSlotId);

        holder.dateText.setText(TimeUtils.formatLongDate(start));
        holder.timeText.setText(holder.itemView.getContext().getString(
                R.string.slot_time_range, TimeUtils.formatTime(start), TimeUtils.formatTime(end)));
        holder.slotText.setText(holder.itemView.getContext().getString(
                R.string.reservation_slot_id, slot.slotId));
        holder.kindChip.setText(current ? R.string.edit_current_slot : R.string.slot_available);
        holder.kindChip.setBackgroundResource(current
                ? R.drawable.bg_chip_neutral : R.drawable.bg_chip_active);
        holder.kindChip.setTextColor(ContextCompat.getColor(holder.itemView.getContext(),
                current ? R.color.on_surface_variant : R.color.primary_container));
        holder.selectedText.setVisibility(selected ? View.VISIBLE : View.GONE);

        holder.card.setStrokeColor(ContextCompat.getColor(holder.itemView.getContext(),
                selected ? R.color.secondary : R.color.border_slate));
        holder.card.setStrokeWidth(Math.round(
                (selected ? 2 : 1) * holder.itemView.getResources().getDisplayMetrics().density));
        holder.card.setCardBackgroundColor(ContextCompat.getColor(holder.itemView.getContext(),
                selected ? R.color.surface_container_low : R.color.surface_container_lowest));
        holder.card.setSelected(selected);
        holder.card.setEnabled(enabled);
        holder.card.setAlpha(enabled ? 1f : 0.65f);
        holder.card.setContentDescription(holder.itemView.getContext().getString(
                R.string.edit_slot_description,
                TimeUtils.formatLongDate(start), TimeUtils.formatTime(start),
                TimeUtils.formatTime(end), slot.slotId,
                holder.itemView.getContext().getString(current
                        ? R.string.edit_current_slot : R.string.slot_available),
                holder.itemView.getContext().getString(selected
                        ? R.string.reservation_selected : R.string.edit_not_selected)));
        holder.card.setOnClickListener(view -> {
            if (enabled) listener.onSelected(slot);
        });
    }

    @Override
    public int getItemCount() {
        // Returns the number of current or available choices shown for one date.
        return slots.size();
    }

    static class SlotHolder extends RecyclerView.ViewHolder {
        final MaterialCardView card;
        final TextView dateText;
        final TextView timeText;
        final TextView slotText;
        final TextView kindChip;
        final TextView selectedText;

        SlotHolder(@NonNull View itemView) {
            super(itemView);
            card = (MaterialCardView) itemView;
            dateText = itemView.findViewById(R.id.editSlotDate);
            timeText = itemView.findViewById(R.id.editSlotTime);
            slotText = itemView.findViewById(R.id.editSlotId);
            kindChip = itemView.findViewById(R.id.editSlotKind);
            selectedText = itemView.findViewById(R.id.editSlotSelected);
        }
    }
}

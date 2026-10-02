// File: ScanHistoryAdapter.java
// Purpose: RecyclerView adapter for the Grid Operator's Recent Scans list, grouped by reservation.
// Each reservation is one card; tapping its header reveals that reservation's scan attempts.

package com.example.smart_solar_mobile.adapters;

import android.annotation.SuppressLint;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.models.QrScanEntryResponse;
import com.example.smart_solar_mobile.utils.TimeUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ScanHistoryAdapter extends RecyclerView.Adapter<ScanHistoryAdapter.GroupViewHolder> {

    // One reservation's scan attempts, newest first (the server already returns scans in that order)
    private static final class ScanGroup {
        final String reservationId;
        final List<QrScanEntryResponse> attempts = new ArrayList<>();
        boolean expanded;

        ScanGroup(String reservationId) {
            this.reservationId = reservationId;
        }
    }

    private final List<ScanGroup> groups = new ArrayList<>();

    @SuppressLint("NotifyDataSetChanged")
    public void setScans(List<QrScanEntryResponse> scans) {
        groups.clear();
        Map<String, ScanGroup> byReservationId = new LinkedHashMap<>();
        for (QrScanEntryResponse scan : scans) {
            ScanGroup group = byReservationId.get(scan.reservationId);
            if (group == null) {
                group = new ScanGroup(scan.reservationId);
                byReservationId.put(scan.reservationId, group);
                groups.add(group);
            }
            group.attempts.add(scan);
        }
        notifyDataSetChanged();
    }

    public boolean isEmpty() {
        return groups.isEmpty();
    }

    @NonNull
    @Override
    public GroupViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_scan_group, parent, false);
        return new GroupViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull GroupViewHolder holder, int position) {
        ScanGroup group = groups.get(position);
        holder.reservationIdText.setText(group.reservationId);
        holder.attemptCountText.setText(holder.itemView.getResources().getQuantityString(
                R.plurals.scan_attempt_count, group.attempts.size(), group.attempts.size()));

        // The most recent attempt is first, since the server returns each operator's scans newest-first
        QrScanEntryResponse latest = group.attempts.get(0);
        Date latestAt = TimeUtils.parseApiDate(latest.at);
        holder.latestAtText.setText(latestAt == null
                ? holder.itemView.getContext().getString(R.string.metric_empty)
                : holder.itemView.getContext().getString(R.string.detail_datetime_value,
                        TimeUtils.formatShortDate(latestAt), TimeUtils.formatTime(latestAt)));
        bindResultChip(holder.latestResultChip, latest.result);

        boolean success = "Success".equalsIgnoreCase(latest.result);
        holder.statusIcon.setImageResource(success ? R.drawable.ic_check : R.drawable.ic_error);
        holder.statusIcon.setColorFilter(ContextCompat.getColor(holder.itemView.getContext(),
                success ? R.color.secondary : R.color.alert_danger));

        holder.chevron.setRotation(group.expanded ? 180f : 0f);
        holder.groupDivider.setVisibility(group.expanded ? View.VISIBLE : View.GONE);
        holder.attemptsContainer.setVisibility(group.expanded ? View.VISIBLE : View.GONE);
        holder.attemptsContainer.removeAllViews();
        if (group.expanded) {
            LayoutInflater inflater = LayoutInflater.from(holder.itemView.getContext());
            for (QrScanEntryResponse attempt : group.attempts) {
                holder.attemptsContainer.addView(buildAttemptRow(inflater, holder.attemptsContainer, attempt));
            }
        }

        holder.headerRow.setOnClickListener(v -> {
            group.expanded = !group.expanded;
            notifyItemChanged(holder.getAdapterPosition());
        });
    }

    @Override
    public int getItemCount() {
        return groups.size();
    }

    private View buildAttemptRow(LayoutInflater inflater, ViewGroup parent, QrScanEntryResponse attempt) {
        View row = inflater.inflate(R.layout.item_scan_attempt, parent, false);
        TextView atText = row.findViewById(R.id.attemptAtText);
        TextView resultChip = row.findViewById(R.id.attemptResultChip);
        TextView reasonText = row.findViewById(R.id.attemptReasonText);

        reasonText.setText(attempt.reason);
        bindResultChip(resultChip, attempt.result);

        Date at = TimeUtils.parseApiDate(attempt.at);
        atText.setText(at == null
                ? row.getContext().getString(R.string.metric_empty)
                : row.getContext().getString(R.string.detail_datetime_value,
                        TimeUtils.formatShortDate(at), TimeUtils.formatTime(at)));
        return row;
    }

    private void bindResultChip(TextView chip, String result) {
        boolean success = "Success".equalsIgnoreCase(result);
        chip.setBackgroundResource(success ? R.drawable.bg_chip_active : R.drawable.bg_chip_danger);
        chip.setTextColor(ContextCompat.getColor(chip.getContext(),
                success ? R.color.primary_container : R.color.alert_danger));
        chip.setText(success ? chip.getContext().getString(R.string.recent_scan_success_label) : result);
    }

    static class GroupViewHolder extends RecyclerView.ViewHolder {
        final View headerRow;
        final ImageView statusIcon;
        final TextView reservationIdText;
        final TextView latestAtText;
        final TextView attemptCountText;
        final TextView latestResultChip;
        final ImageView chevron;
        final View groupDivider;
        final LinearLayout attemptsContainer;

        GroupViewHolder(View itemView) {
            super(itemView);
            headerRow = itemView.findViewById(R.id.scanGroupHeaderRow);
            statusIcon = itemView.findViewById(R.id.groupStatusIcon);
            reservationIdText = itemView.findViewById(R.id.groupReservationIdText);
            latestAtText = itemView.findViewById(R.id.groupLatestAtText);
            attemptCountText = itemView.findViewById(R.id.groupAttemptCountText);
            latestResultChip = itemView.findViewById(R.id.groupLatestResultChip);
            chevron = itemView.findViewById(R.id.groupChevron);
            groupDivider = itemView.findViewById(R.id.groupDivider);
            attemptsContainer = itemView.findViewById(R.id.attemptsContainer);
        }
    }
}

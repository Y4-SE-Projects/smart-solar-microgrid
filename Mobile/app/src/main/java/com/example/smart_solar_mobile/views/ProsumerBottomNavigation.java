// File: ProsumerBottomNavigation.java
// Purpose: Reusable Prosumer-only top-level navigation based on UI/prosumer_dashboard.html.

package com.example.smart_solar_mobile.views;

import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.activities.ProfileActivity;
import com.example.smart_solar_mobile.activities.ProsumerHomeActivity;
import com.example.smart_solar_mobile.activities.ReservationHistoryActivity;
import com.example.smart_solar_mobile.activities.StationMapActivity;

import java.util.EnumMap;

public class ProsumerBottomNavigation extends LinearLayout {
    public enum Destination {
        HOME, STATIONS, BOOKINGS, PROFILE
    }

    private final EnumMap<Destination, View> items = new EnumMap<>(Destination.class);
    private final EnumMap<Destination, ImageView> icons = new EnumMap<>(Destination.class);
    private final EnumMap<Destination, TextView> labels = new EnumMap<>(Destination.class);

    private AppCompatActivity host;
    private Destination currentDestination;

    public ProsumerBottomNavigation(Context context) {
        super(context);
        initialize();
    }

    public ProsumerBottomNavigation(Context context, AttributeSet attrs) {
        super(context, attrs);
        initialize();
    }

    public ProsumerBottomNavigation(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        initialize();
    }

    private void initialize() {
        // Inflates the single Prosumer navigation layout and binds its four destinations.
        setOrientation(VERTICAL);
        setBackgroundColor(ContextCompat.getColor(getContext(), R.color.surface_container_lowest));
        setElevation(4f * getResources().getDisplayMetrics().density);
        LayoutInflater.from(getContext()).inflate(R.layout.view_prosumer_bottom_navigation, this, true);
        bind(Destination.HOME, R.id.prosumerNavHome,
                R.id.prosumerNavHomeIcon, R.id.prosumerNavHomeLabel);
        bind(Destination.STATIONS, R.id.prosumerNavStations,
                R.id.prosumerNavStationsIcon, R.id.prosumerNavStationsLabel);
        bind(Destination.BOOKINGS, R.id.prosumerNavBookings,
                R.id.prosumerNavBookingsIcon, R.id.prosumerNavBookingsLabel);
        bind(Destination.PROFILE, R.id.prosumerNavProfile,
                R.id.prosumerNavProfileIcon, R.id.prosumerNavProfileLabel);
    }

    private void bind(Destination destination, int itemId, int iconId, int labelId) {
        // Keeps item views and routing in this component rather than in Activities.
        View item = findViewById(itemId);
        items.put(destination, item);
        icons.put(destination, findViewById(iconId));
        labels.put(destination, findViewById(labelId));
        item.setOnClickListener(view -> navigate(destination));
    }

    public void setup(@NonNull AppCompatActivity activity, @NonNull Destination destination) {
        // Each Prosumer top-level Activity declares the item representing its current screen.
        host = activity;
        currentDestination = destination;
        renderSelection();
    }

    private void renderSelection() {
        // Keeps the active icon and stronger label deep green, with secondary slate destinations.
        for (Destination destination : Destination.values()) {
            View item = items.get(destination);
            ImageView icon = icons.get(destination);
            TextView label = labels.get(destination);
            boolean selected = destination == currentDestination;
            int color = ContextCompat.getColor(getContext(),
                    selected ? R.color.primary : R.color.on_surface_variant);

            item.setSelected(selected);
            icon.setSelected(selected);
            icon.setImageTintList(ColorStateList.valueOf(color));
            label.setTextColor(color);
            label.setTypeface(Typeface.create(
                    selected ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));

            String name = label.getText().toString();
            if (selected) {
                item.setContentDescription(getContext().getString(
                        R.string.prosumer_nav_selected_description, name));
            } else {
                item.setContentDescription(name);
            }
        }
    }

    private void navigate(Destination destination) {
        // Reuses each top-level Activity and keeps Home as the root of Prosumer navigation.
        if (host == null || destination == currentDestination) return;

        Class<?> target;
        switch (destination) {
            case HOME:
                target = ProsumerHomeActivity.class;
                break;
            case STATIONS:
                target = StationMapActivity.class;
                break;
            case BOOKINGS:
                target = ReservationHistoryActivity.class;
                break;
            case PROFILE:
                target = ProfileActivity.class;
                break;
            default:
                return;
        }

        Intent intent = new Intent(host, target);
        if (destination == Destination.HOME) {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        }
        host.startActivity(intent);
        if (currentDestination != Destination.HOME) {
            host.finish();
        }
    }
}

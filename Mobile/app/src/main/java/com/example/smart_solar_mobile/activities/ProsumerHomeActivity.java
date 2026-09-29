// File: ProsumerHomeActivity.java
// Purpose: Home screen a Prosumer lands on after login.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.views.ProsumerBottomNavigation;

public class ProsumerHomeActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Shows the signed-in Prosumer and offers map and direct booking entries.
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_prosumer_home);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.homeRoot));
        ((ProsumerBottomNavigation) findViewById(R.id.prosumerBottomNavigation))
                .setup(this, ProsumerBottomNavigation.Destination.HOME);

        TextView greetingText = findViewById(R.id.greetingText);
        TextView identifierText = findViewById(R.id.identifierText);

        findViewById(R.id.signOutButton).setOnClickListener(v ->
                SessionManager.getInstance().endSession(() -> Navigator.openLogin(this, false)));
        // Keeps the Member 02 nearby-map path and its preselected-station handoff.
        findViewById(R.id.createReservationButton).setOnClickListener(v ->
                startActivity(new Intent(this, StationMapActivity.class)));
        // Direct booking works without location permission or a nearby-map result.
        findViewById(R.id.directReservationButton).setOnClickListener(v ->
                startActivity(new Intent(this, CreateReservationActivity.class)));

        findViewById(R.id.viewReservationsButton).setOnClickListener(v ->
                startActivity(new Intent(this, ReservationHistoryActivity.class)));

        // Loads the session here too, because Android can reopen the app straight onto this screen.
        SessionManager.getInstance().loadSession(session -> {
            if (session == null || !Roles.PROSUMER.equals(session.role)) {
                Navigator.openLogin(this, false);
                return;
            }
            String name = session.fullName == null || session.fullName.isEmpty()
                    ? session.identifier : session.fullName;
            greetingText.setText(getString(R.string.home_greeting, name));
            identifierText.setText(getString(R.string.home_nic, session.identifier));
        });
    }
}

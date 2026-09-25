// File: ProsumerHomeActivity.java
// Purpose: Home screen a Prosumer lands on after login.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.utils.InsetsHelper;

public class ProsumerHomeActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Shows the signed-in Prosumer's details and the sign-out action
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_prosumer_home);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.homeRoot));

        TextView greetingText = findViewById(R.id.greetingText);
        TextView identifierText = findViewById(R.id.identifierText);

        findViewById(R.id.signOutButton).setOnClickListener(v ->
                SessionManager.getInstance().endSession(() -> Navigator.openLogin(this, false)));

        // Loads the session here too, because Android can reopen the app straight onto this screen
        SessionManager.getInstance().loadSession(session -> {
            if (session == null || !Roles.PROSUMER.equals(session.role)) {
                Navigator.openLogin(this, false);
                return;
            }
            String name = session.fullName == null || session.fullName.isEmpty() ? session.identifier : session.fullName;
            greetingText.setText(getString(R.string.home_greeting, name));
            identifierText.setText(getString(R.string.home_nic, session.identifier));
        });
    }
}

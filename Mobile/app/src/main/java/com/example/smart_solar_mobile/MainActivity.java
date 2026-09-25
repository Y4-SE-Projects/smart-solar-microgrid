// File: MainActivity.java
// Purpose: Launch screen that opens the right home screen if a session is saved in SQLite, or the login screen if not.
// Author: IT23215856

package com.example.smart_solar_mobile;

import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.activities.Navigator;
import com.example.smart_solar_mobile.db.SessionManager;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Checks for a saved session and routes to the matching screen
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        SessionManager.getInstance().loadSession(session -> {
            if (session == null || !Navigator.openHome(this, session.role)) {
                Navigator.openLogin(this, false);
            }
            finish();
        });
    }
}

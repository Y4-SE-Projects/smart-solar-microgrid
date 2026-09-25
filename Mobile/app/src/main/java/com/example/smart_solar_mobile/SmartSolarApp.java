// File: SmartSolarApp.java
// Purpose: Application class that sets up app-wide services before any screen opens.
// Author: IT23215856

package com.example.smart_solar_mobile;

import android.app.Application;

import com.example.smart_solar_mobile.db.SessionManager;

public class SmartSolarApp extends Application {
    private static SmartSolarApp instance;

    @Override
    public void onCreate() {
        // Prepares the session store so screens and the network layer can use it
        super.onCreate();
        instance = this;
        SessionManager.init(this);
    }

    public static SmartSolarApp get() {
        // Gives code outside a screen (e.g. the network layer) an app context
        return instance;
    }
}

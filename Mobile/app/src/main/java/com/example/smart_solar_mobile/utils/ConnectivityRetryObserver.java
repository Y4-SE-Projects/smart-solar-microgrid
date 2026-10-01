// File: ConnectivityRetryObserver.java
// Purpose: Retries a failed API sync when Android reports that a network is available again.

package com.example.smart_solar_mobile.utils;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

public class ConnectivityRetryObserver {
    private final ConnectivityManager connectivityManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable onAvailable;
    private final Runnable onLost;
    private boolean registered;

    private final ConnectivityManager.NetworkCallback callback = new ConnectivityManager.NetworkCallback() {
        @Override
        public void onAvailable(@NonNull Network network) {
            // Connectivity is only a retry trigger; the API response establishes freshness.
            mainHandler.post(() -> { if (registered) onAvailable.run(); });
        }

        @Override
        public void onLost(@NonNull Network network) {
            mainHandler.post(() -> { if (registered) onLost.run(); });
        }
    };

    public ConnectivityRetryObserver(Context context, Runnable onAvailable, Runnable onLost) {
        connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        this.onAvailable = onAvailable;
        this.onLost = onLost;
    }

    public void start() {
        // One callback per visible Activity; a failed registration leaves manual Retry available.
        if (registered || connectivityManager == null) return;
        try {
            connectivityManager.registerDefaultNetworkCallback(callback);
            registered = true;
        } catch (RuntimeException ignored) {
            registered = false;
        }
    }

    public void stop() {
        // Remove callbacks when the Activity leaves the foreground to avoid leaks or duplicate work.
        if (!registered || connectivityManager == null) return;
        registered = false;
        try {
            connectivityManager.unregisterNetworkCallback(callback);
        } catch (RuntimeException ignored) {
            // The Activity is already stopping; no callback may update it now.
        }
    }
}

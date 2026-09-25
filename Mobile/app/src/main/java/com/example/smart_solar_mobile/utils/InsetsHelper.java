// File: InsetsHelper.java
// Purpose: Keeps screen content clear of the status bar, navigation bar and keyboard.
// Author: IT23215856

package com.example.smart_solar_mobile.utils;

import android.graphics.Color;
import android.view.View;

import androidx.activity.ComponentActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public final class InsetsHelper {
    // Scrim behind navigation bar icons on Android versions that can't draw dark icons
    private static final int NAV_BAR_DARK_SCRIM = Color.argb(0x80, 0x1B, 0x1B, 0x1B);

    private InsetsHelper() {
        // Static helper only, never instantiated
    }

    public static void applyEdgeToEdge(ComponentActivity activity, View root) {
        // Draws behind transparent system bars with dark icons (Android 15 forces this anyway)
        EdgeToEdge.enable(activity,
                SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
                SystemBarStyle.light(Color.TRANSPARENT, NAV_BAR_DARK_SCRIM));

        // Pads the root view by the system bar and keyboard sizes; the root should have no padding of its own
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}

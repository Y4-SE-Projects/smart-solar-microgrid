// File: Navigator.java
// Purpose: Moves between the login screen and each role's home screen.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.content.Context;
import android.content.Intent;

import com.example.smart_solar_mobile.models.Roles;

public final class Navigator {
    public static final String EXTRA_SESSION_EXPIRED = "session_expired";

    private Navigator() {
        // Static helper only, never instantiated
    }

    public static boolean openHome(Context context, String role) {
        // Opens the home screen for the role and clears the back stack; returns false for roles the app doesn't serve
        Class<?> target;
        if (Roles.PROSUMER.equals(role)) {
            target = ProsumerHomeActivity.class;
        } else if (Roles.GRID_OPERATOR.equals(role)) {
            target = OperatorHomeActivity.class;
        } else {
            return false;
        }

        Intent intent = new Intent(context, target);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        context.startActivity(intent);
        return true;
    }

    public static void openLogin(Context context, boolean sessionExpired) {
        // Opens the login screen and clears the back stack so Back can't return to a signed-in screen
        Intent intent = new Intent(context, LoginActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        intent.putExtra(EXTRA_SESSION_EXPIRED, sessionExpired);
        context.startActivity(intent);
    }
}

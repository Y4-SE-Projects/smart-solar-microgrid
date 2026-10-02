// File: FieldChecks.java
// Purpose: Small form checks shared by the registration screen and the change-password dialog.
//          They only save a round trip; the API applies the same rules and stays authoritative.
// Author: IT23218512

package com.example.smart_solar_mobile.utils;

import com.example.smart_solar_mobile.R;
import com.google.android.material.textfield.TextInputLayout;

public final class FieldChecks {

    private FieldChecks() {
        // Static helper only, never instantiated
    }

    public static boolean requireNotOnlySpaces(TextInputLayout layout, String password) {
        // Marks a new password made only of spaces, which the API refuses, and reports whether it passed
        if (password.trim().isEmpty()) {
            layout.setError(layout.getContext().getString(R.string.password_error_only_spaces));
            return false;
        }
        return true;
    }
}

// File: DialogUtils.java
// Purpose: Shared helpers for dialogs that send a request and keep errors inside the dialog,
//          used by the profile screen and the deactivated-account dialogs on login.
//          A dialog body using these must contain dialogErrorBanner / dialogErrorText.
// Author: IT23218512

package com.example.smart_solar_mobile.utils;

import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.StringRes;
import androidx.appcompat.app.AlertDialog;

import com.example.smart_solar_mobile.R;

public final class DialogUtils {

    private DialogUtils() {
        // Static helper only, never instantiated
    }

    public static void setBusy(AlertDialog dialog, View content, boolean busy,
                               @StringRes int busyText, @StringRes int idleText) {
        // Locks a dialog while its request is in flight so it can't be sent twice or closed half-way
        dialog.setCancelable(!busy);
        Button positive = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
        positive.setEnabled(!busy);
        positive.setText(busy ? busyText : idleText);
        dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(!busy);
        setInputsEnabled(content, !busy);
    }

    public static void showError(View content, String message) {
        // Shows a message in the dialog's own red banner
        ((TextView) content.findViewById(R.id.dialogErrorText)).setText(message);
        content.findViewById(R.id.dialogErrorBanner).setVisibility(View.VISIBLE);
    }

    public static void hideError(View content) {
        // Hides the dialog's red banner before a new attempt
        content.findViewById(R.id.dialogErrorBanner).setVisibility(View.GONE);
    }

    private static void setInputsEnabled(View view, boolean enabled) {
        // Enables or disables every text field inside a dialog body
        if (view instanceof EditText) {
            view.setEnabled(enabled);
        } else if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                setInputsEnabled(group.getChildAt(i), enabled);
            }
        }
    }
}

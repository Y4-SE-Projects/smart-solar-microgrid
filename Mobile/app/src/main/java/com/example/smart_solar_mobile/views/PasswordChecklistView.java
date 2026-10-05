// File: PasswordChecklistView.java
// Purpose: Live list of the new-password requirements under a password field, each ticked off as it is met, as on the web forms.
//          Used by registration and the change-password dialog. The requirements themselves come from AccountRules.passwordChecks.
// Author: IT23218512

package com.example.smart_solar_mobile.views;

import android.content.Context;
import android.graphics.drawable.Drawable;
import android.text.Editable;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.utils.AccountRules;
import com.example.smart_solar_mobile.utils.LiveValidation;

import java.util.List;

public class PasswordChecklistView extends LinearLayout {
    // Icon size beside each requirement, smaller than the 24dp the icons are drawn at
    private static final int ICON_SIZE_DP = 16;

    // One row per requirement, in the order AccountRules.passwordChecks returns them
    private TextView[] rows;
    private String password = "";
    // True once the field has been left or submitted; unmet requirements then turn red
    private boolean showUnmet;

    public PasswordChecklistView(Context context) {
        super(context);
        initialize();
    }

    public PasswordChecklistView(Context context, AttributeSet attrs) {
        super(context, attrs);
        initialize();
    }

    public PasswordChecklistView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        initialize();
    }

    private void initialize() {
        // Inflates the rows and shows every requirement as not met yet
        setOrientation(VERTICAL);
        LayoutInflater.from(getContext()).inflate(R.layout.view_password_checklist, this, true);
        rows = new TextView[]{
                findViewById(R.id.passwordRuleLength),
                findViewById(R.id.passwordRuleUppercase),
                findViewById(R.id.passwordRuleLowercase),
                findViewById(R.id.passwordRuleNumber),
                findViewById(R.id.passwordRuleSpecial)
        };
        render();
    }

    public void follow(EditText passwordInput, LiveValidation passwordCheck) {
        // Ticks the list from the first keystroke, and turns unmet requirements red whenever the field's message is showing
        LiveValidation.afterEachChange(passwordInput, () -> {
            Editable text = passwordInput.getText();
            password = text == null ? "" : text.toString();
            render();
        });
        passwordCheck.setListener(error -> {
            boolean unmetRed = error != null;
            if (showUnmet != unmetRed) {
                showUnmet = unmetRed;
                render();
            }
        });
    }

    private void render() {
        // Icon, colour and spoken state for each requirement
        List<AccountRules.PasswordCheck> checks = AccountRules.passwordChecks(password);
        int iconSize = Math.round(ICON_SIZE_DP * getResources().getDisplayMetrics().density);
        for (int i = 0; i < rows.length; i++) {
            AccountRules.PasswordCheck check = checks.get(i);
            int color = ContextCompat.getColor(getContext(), check.met ? R.color.secondary
                    : showUnmet ? R.color.alert_danger : R.color.on_surface_variant);

            Drawable icon = ContextCompat.getDrawable(getContext(),
                    check.met ? R.drawable.ic_check_circle : R.drawable.ic_radio_unchecked);
            if (icon != null) {
                icon = icon.mutate();
                icon.setBounds(0, 0, iconSize, iconSize);
                icon.setTint(color);
            }
            TextView row = rows[i];
            row.setCompoundDrawablesRelative(icon, null, null, null);
            row.setTextColor(color);
            String label = getContext().getString(check.labelRes);
            row.setContentDescription(getContext().getString(
                    check.met ? R.string.password_rule_met : R.string.password_rule_missing, label));
        }
    }
}

// File: AccountRules.java
// Purpose: The account field rules the mobile forms check, mirroring the API's AccountRules and NicFormat.
//          They only save a round trip and put the message next to the field; the API applies the same rules and stays authoritative.
//          Each check returns the message to show, or null when the value is valid.
// Author: IT23218512

package com.example.smart_solar_mobile.utils;

import android.content.Context;

import androidx.annotation.Nullable;
import androidx.annotation.StringRes;

import com.example.smart_solar_mobile.R;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

public final class AccountRules {
    // A NIC is 9 digits then V or X (old format) or 12 digits (new format)
    public static final int NIC_DIGITS_BEFORE_LETTER = 9;
    private static final Pattern NIC_PATTERN = Pattern.compile("^([0-9]{9}[VvXx]|[0-9]{12})$");

    public static final int MINIMUM_FULL_NAME_LENGTH = 2;
    // English letters and spaces only: no digits, symbols, dots, apostrophes or hyphens
    private static final Pattern FULL_NAME_PATTERN = Pattern.compile("^[A-Za-z ]+$");

    // Something@something.something, with no spaces and a single "@"
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    // A Sri Lankan mobile number, written locally ( 0771234567 ) or internationally ( +94771234567 ), with no spaces
    public static final int LOCAL_PHONE_LENGTH = 10;
    public static final int INTERNATIONAL_PHONE_LENGTH = 12;
    private static final Pattern PHONE_PATTERN = Pattern.compile("^(07[0-9]{8}|\\+947[0-9]{8})$");

    public static final int MINIMUM_PASSWORD_LENGTH = 8;
    // Bcrypt only uses the first 72 bytes of a password; symbols and non-English letters take 2–4 bytes each
    public static final int MAXIMUM_PASSWORD_BYTES = 72;

    private AccountRules() {
        // Static helper only, never instantiated
    }

    @Nullable
    public static String nicError(Context context, String nic) {
        // A required NIC in either format
        String trimmed = nic.trim();
        if (trimmed.isEmpty()) {
            return context.getString(R.string.login_error_nic_required);
        }
        return NIC_PATTERN.matcher(trimmed).matches() ? null : context.getString(R.string.account_error_nic_format);
    }

    @Nullable
    public static String fullNameError(Context context, String fullName) {
        // A required full name of letters and spaces; the box's maxLength keeps it within 100 characters
        String trimmed = fullName.trim();
        if (trimmed.isEmpty()) {
            return context.getString(R.string.register_error_full_name_required);
        }
        if (!FULL_NAME_PATTERN.matcher(trimmed).matches()) {
            return context.getString(R.string.account_error_full_name_characters);
        }
        if (trimmed.length() < MINIMUM_FULL_NAME_LENGTH) {
            return context.getString(R.string.account_error_full_name_short, MINIMUM_FULL_NAME_LENGTH);
        }
        return null;
    }

    @Nullable
    public static String emailError(Context context, String email) {
        // A required email address; the box's maxLength keeps it within 254 characters
        String trimmed = email.trim();
        if (trimmed.isEmpty()) {
            return context.getString(R.string.register_error_email_required);
        }
        return EMAIL_PATTERN.matcher(trimmed).matches() ? null : context.getString(R.string.account_error_email_format);
    }

    @Nullable
    public static String phoneError(Context context, String phone) {
        // A required Sri Lankan mobile number
        String trimmed = phone.trim();
        if (trimmed.isEmpty()) {
            return context.getString(R.string.register_error_phone_required);
        }
        return PHONE_PATTERN.matcher(trimmed).matches() ? null : context.getString(R.string.account_error_phone_format);
    }

    @Nullable
    public static String newPasswordError(Context context, String password, @StringRes int requiredRes) {
        // A password that is about to be set. The checklist under the box names what is missing, so the message only points to it.
        // Never used on a password being checked ( the current password ): older passwords made before these rules still sign in.
        if (password.isEmpty()) {
            return context.getString(requiredRes);
        }
        return meetsAll(password) ? null : context.getString(R.string.account_error_password_rules);
    }

    @Nullable
    public static String confirmPasswordError(Context context, String confirm, String password) {
        // The second copy of a new password must match the first
        if (confirm.isEmpty()) {
            return context.getString(R.string.register_error_confirm_required);
        }
        return confirm.equals(password) ? null : context.getString(R.string.register_error_password_mismatch);
    }

    // PASSWORD CHECKSLIST

    // One requirement of a new password and whether the value meets it yet
    public static final class PasswordCheck {
        @StringRes
        public final int labelRes;
        public final boolean met;

        PasswordCheck(@StringRes int labelRes, boolean met) {
            this.labelRes = labelRes;
            this.met = met;
        }
    }

    public static List<PasswordCheck> passwordChecks(String password) {
        // Each requirement in the order the checklist shows them. Spaces aren't listed: the password boxes don't accept them.
        int byteCount = password.getBytes(StandardCharsets.UTF_8).length;
        boolean upper = false;
        boolean lower = false;
        boolean digit = false;
        boolean special = false;
        for (int i = 0; i < password.length(); i++) {
            char c = password.charAt(i);
            if (c >= 'A' && c <= 'Z') {
                upper = true;
            } else if (c >= 'a' && c <= 'z') {
                lower = true;
            } else if (c >= '0' && c <= '9') {
                digit = true;
            } else if (!Character.isWhitespace(c)) {
                // Anything other than an English letter, a digit or a space, e.g. ! @ # $ % _ -. Same definition as the API.
                special = true;
            }
        }
        return Arrays.asList(
                new PasswordCheck(R.string.password_rule_length,
                        password.length() >= MINIMUM_PASSWORD_LENGTH && byteCount <= MAXIMUM_PASSWORD_BYTES),
                new PasswordCheck(R.string.password_rule_uppercase, upper),
                new PasswordCheck(R.string.password_rule_lowercase, lower),
                new PasswordCheck(R.string.password_rule_number, digit),
                new PasswordCheck(R.string.password_rule_special, special));
    }

    private static boolean meetsAll(String password) {
        // True when there are no spaces and every checklist item is met
        for (int i = 0; i < password.length(); i++) {
            if (Character.isWhitespace(password.charAt(i))) {
                return false;
            }
        }
        for (PasswordCheck check : passwordChecks(password)) {
            if (!check.met) {
                return false;
            }
        }
        return true;
    }
}

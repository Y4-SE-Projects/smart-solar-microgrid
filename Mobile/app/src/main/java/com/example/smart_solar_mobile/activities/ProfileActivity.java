// File: ProfileActivity.java
// Purpose: Prosumer "My Account" screen: view the profile from GET /api/users/{nic}, edit it with PUT /api/users/{nic},
//          change the password and deactivate the account.
// Author: IT23218512

package com.example.smart_solar_mobile.activities;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.ChangePasswordRequest;
import com.example.smart_solar_mobile.models.DeactivateAccountRequest;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.models.UpdateProfileRequest;
import com.example.smart_solar_mobile.models.UserProfile;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.AccountRules;
import com.example.smart_solar_mobile.utils.AllowedInput;
import com.example.smart_solar_mobile.utils.DialogUtils;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.LiveValidation;
import com.example.smart_solar_mobile.utils.NameUtils;
import com.example.smart_solar_mobile.utils.TimeUtils;
import com.example.smart_solar_mobile.views.PasswordChecklistView;
import com.example.smart_solar_mobile.views.ProsumerBottomNavigation;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.material.textfield.TextInputEditText;

import java.util.Date;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileActivity extends AppCompatActivity {
    // The last saved values, kept through rotation so unsaved edits aren't overwritten by a reload
    private static final String STATE_SAVED_NAME = "saved_full_name";
    private static final String STATE_SAVED_EMAIL = "saved_email";
    private static final String STATE_SAVED_PHONE = "saved_phone";

    private View profileLoadingText;
    private View loadErrorBanner;
    private TextView loadErrorText;
    private View profileContent;
    private TextView avatarText;
    private TextView nameText;
    private TextView nicText;
    private View accountStatusChip;
    private TextView memberSinceText;
    private TextInputEditText fullNameInput;
    private TextInputEditText emailInput;
    private TextInputEditText phoneInput;
    private LiveValidation[] detailChecks;
    private View saveErrorBanner;
    private TextView saveErrorText;
    private MaterialButton saveButton;

    // NIC from the saved session; every call here is only allowed for the signed-in Prosumer's own NIC
    private String prosumerNic;
    // Values as last loaded or saved; null until the profile has loaded once
    private String savedFullName;
    private String savedEmail;
    private String savedPhone;
    private boolean saving;

    private Call<ApiResponse<UserProfile>> profileCall;
    private Call<ApiResponse<Void>> saveCall;
    private Call<ApiResponse<Void>> passwordCall;
    private Call<ApiResponse<Void>> deactivateCall;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds the screen, restores unsaved edits after rotation and loads the profile
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_profile);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.profileRoot));
        ((ProsumerBottomNavigation) findViewById(R.id.prosumerBottomNavigation))
                .setup(this, ProsumerBottomNavigation.Destination.PROFILE);
        bindViews();

        if (savedInstanceState != null) {
            savedFullName = savedInstanceState.getString(STATE_SAVED_NAME);
            savedEmail = savedInstanceState.getString(STATE_SAVED_EMAIL);
            savedPhone = savedInstanceState.getString(STATE_SAVED_PHONE);
        }

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        findViewById(R.id.loadRetryButton).setOnClickListener(v -> loadProfile());
        saveButton.setOnClickListener(v -> saveProfile());
        findViewById(R.id.changePasswordButton).setOnClickListener(v -> showChangePasswordDialog());
        findViewById(R.id.deactivateButton).setOnClickListener(v -> showDeactivateDialog());

        TextWatcher changeWatcher = new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
                // Not needed; only the text after a change matters
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                // Not needed; only the text after a change matters
            }

            @Override
            public void afterTextChanged(Editable s) {
                // Re-checks whether there is anything to save after every keystroke
                updateSaveButton();
            }
        };
        fullNameInput.addTextChangedListener(changeWatcher);
        emailInput.addTextChangedListener(changeWatcher);
        phoneInput.addTextChangedListener(changeWatcher);

        // Loads the session here too, because Android can reopen the app straight onto this screen
        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || session.identifier == null || session.identifier.trim().isEmpty()) {
                Navigator.openLogin(this, false);
                return;
            }
            prosumerNic = session.identifier;
            loadProfile();
        });
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Keeps the last saved values, so a rotation doesn't treat unsaved edits as saved
        super.onSaveInstanceState(outState);
        outState.putString(STATE_SAVED_NAME, savedFullName);
        outState.putString(STATE_SAVED_EMAIL, savedEmail);
        outState.putString(STATE_SAVED_PHONE, savedPhone);
    }

    @Override
    protected void onDestroy() {
        // Drops in-flight requests so their replies can't touch a closed screen
        cancel(profileCall);
        cancel(saveCall);
        cancel(passwordCall);
        cancel(deactivateCall);
        super.onDestroy();
    }

    private void bindViews() {
        // Looks up every view the screen updates
        profileLoadingText = findViewById(R.id.profileLoadingText);
        loadErrorBanner = findViewById(R.id.loadErrorBanner);
        loadErrorText = findViewById(R.id.loadErrorText);
        profileContent = findViewById(R.id.profileContent);
        avatarText = findViewById(R.id.avatarText);
        nameText = findViewById(R.id.nameText);
        nicText = findViewById(R.id.nicText);
        accountStatusChip = findViewById(R.id.accountStatusChip);
        memberSinceText = findViewById(R.id.memberSinceText);
        fullNameInput = findViewById(R.id.fullNameInput);
        emailInput = findViewById(R.id.emailInput);
        phoneInput = findViewById(R.id.phoneInput);
        saveErrorBanner = findViewById(R.id.saveErrorBanner);
        saveErrorText = findViewById(R.id.saveErrorText);
        saveButton = findViewById(R.id.saveButton);
        setUpDetailChecks();
    }

    private void setUpDetailChecks() {
        // Blocks characters each field doesn't accept, and shows each field's message once it has been left, then live as it changes.
        AllowedInput.restrict(fullNameInput, AllowedInput.FULL_NAME);
        AllowedInput.restrict(emailInput, AllowedInput.NO_SPACES);
        AllowedInput.restrict(phoneInput, AllowedInput.PHONE);

        detailChecks = new LiveValidation[]{
                new LiveValidation(findViewById(R.id.fullNameLayout), value -> AccountRules.fullNameError(this, value)),
                new LiveValidation(findViewById(R.id.emailLayout), value -> AccountRules.emailError(this, value)),
                new LiveValidation(findViewById(R.id.phoneLayout), value -> AccountRules.phoneError(this, value))
        };
    }

    // LOAD 

    private void loadProfile() {
        // Reads the live profile; the form is only filled the first time, so edits survive a retry or rotation
        cancel(profileCall);
        loadErrorBanner.setVisibility(View.GONE);
        if (profileContent.getVisibility() != View.VISIBLE) {
            profileLoadingText.setVisibility(View.VISIBLE);
        }

        profileCall = NetworkManager.getInstance().getApiService().getProfile(prosumerNic);
        final Call<ApiResponse<UserProfile>> call = profileCall;
        call.enqueue(new Callback<ApiResponse<UserProfile>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<UserProfile>> request,
                                   @NonNull Response<ApiResponse<UserProfile>> response) {
                // Shows the profile, or the API's reason it couldn't be loaded
                if (isStale(call, profileCall)) {
                    return;
                }
                profileLoadingText.setVisibility(View.GONE);
                ApiResponse<UserProfile> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    showProfile(body.data);
                } else {
                    showLoadError(ApiErrorParser.getMessage(ProfileActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<UserProfile>> request, @NonNull Throwable t) {
                // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                if (isStale(call, profileCall)) {
                    return;
                }
                profileLoadingText.setVisibility(View.GONE);
                showLoadError(getString(R.string.error_network));
            }
        });
    }

    private void showProfile(UserProfile profile) {
        // Fills the identity card, and the form unless it already holds values from before a rotation
        renderIdentity(profile.fullName, profile.nic);
        accountStatusChip.setVisibility(UserProfile.STATUS_ACTIVE.equals(profile.status) ? View.VISIBLE : View.GONE);
        Date createdAt = TimeUtils.parseApiDate(profile.createdAt);
        memberSinceText.setText(createdAt == null
                ? getString(R.string.metric_empty) : TimeUtils.formatMonthYear(createdAt));

        if (savedFullName == null) {
            savedFullName = nullToEmpty(profile.fullName);
            savedEmail = nullToEmpty(profile.email);
            savedPhone = nullToEmpty(profile.phone);
            fullNameInput.setText(savedFullName);
            emailInput.setText(savedEmail);
            phoneInput.setText(savedPhone);
        }
        profileContent.setVisibility(View.VISIBLE);
        updateSaveButton();
    }

    private void renderIdentity(String fullName, String nic) {
        // Name, initials and NIC at the top of the screen
        String name = fullName == null || fullName.trim().isEmpty() ? nic : fullName.trim();
        avatarText.setText(NameUtils.initialsOf(name));
        nameText.setText(name);
        nicText.setText(getString(R.string.home_nic, nic));
    }

    private void showLoadError(String message) {
        // Explains why the profile couldn't be loaded, with Retry beside the message
        loadErrorText.setText(getString(R.string.action_error, getString(R.string.profile_load_error), message));
        loadErrorBanner.setVisibility(View.VISIBLE);
    }

    // SAVE 

    private void updateSaveButton() {
        // Save is only offered when a field differs from what was last saved and nothing is in flight
        if (savedFullName == null) {
            saveButton.setEnabled(false);
            return;
        }
        boolean changed = !textOf(fullNameInput).trim().equals(savedFullName)
                || !textOf(emailInput).trim().equals(savedEmail)
                || !textOf(phoneInput).trim().equals(savedPhone);
        saveButton.setEnabled(changed && !saving);
    }

    private void saveProfile() {
        // Checks the three editable fields against the account rules, then sends them to the API
        saveErrorBanner.setVisibility(View.GONE);
        // These checks only save a round trip; the API applies the same rules
        if (!LiveValidation.validateAll(detailChecks)) {
            return;
        }

        String fullName = textOf(fullNameInput).trim();
        String email = textOf(emailInput).trim();
        String phone = textOf(phoneInput).trim();

        setSaving(true);
        saveCall = NetworkManager.getInstance().getApiService()
                .updateProfile(prosumerNic, new UpdateProfileRequest(fullName, email, phone));
        final Call<ApiResponse<Void>> call = saveCall;
        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<Void>> request,
                                   @NonNull Response<ApiResponse<Void>> response) {
                // On success the new values become the saved baseline and the saved login gets the new name
                if (isStale(call, saveCall)) {
                    return;
                }
                if (response.isSuccessful()) {
                    savedFullName = fullName;
                    savedEmail = email;
                    savedPhone = phone;
                    renderIdentity(fullName, prosumerNic);
                    SessionManager.getInstance().updateFullName(fullName, () -> { });
                    setSaving(false);
                    Snackbar.make(findViewById(R.id.profileRoot), R.string.profile_saved, Snackbar.LENGTH_SHORT).show();
                } else {
                    setSaving(false);
                    showSaveError(ApiErrorParser.getMessage(ProfileActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<Void>> request, @NonNull Throwable t) {
                // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                if (isStale(call, saveCall)) {
                    return;
                }
                setSaving(false);
                showSaveError(getString(R.string.error_network));
            }
        });
    }

    private void setSaving(boolean inFlight) {
        // Locks the form while saving so it can't be sent twice
        saving = inFlight;
        saveButton.setText(inFlight ? R.string.profile_saving : R.string.profile_save);
        fullNameInput.setEnabled(!inFlight);
        emailInput.setEnabled(!inFlight);
        phoneInput.setEnabled(!inFlight);
        updateSaveButton();
    }

    private void showSaveError(String message) {
        // Shows the API's reason above the Save button
        saveErrorText.setText(message);
        saveErrorBanner.setVisibility(View.VISIBLE);
    }

    // CHANGE PASSWORD

    private void showChangePasswordDialog() {
        // Asks for the current password plus the new one twice; errors stay inside the dialog so it can be corrected
        View content = LayoutInflater.from(this).inflate(R.layout.dialog_change_password, null);
        TextInputEditText currentInput = content.findViewById(R.id.currentPasswordInput);
        TextInputEditText newInput = content.findViewById(R.id.newPasswordInput);
        TextInputEditText confirmInput = content.findViewById(R.id.confirmNewPasswordInput);

        // The current password is only checked for being filled in, and still accepts spaces.
        AllowedInput.restrict(newInput, AllowedInput.NO_SPACES);
        AllowedInput.restrict(confirmInput, AllowedInput.NO_SPACES);
        LiveValidation newCheck = new LiveValidation(content.findViewById(R.id.newPasswordLayout),
                value -> AccountRules.newPasswordError(this, value, R.string.password_error_new_required));
        ((PasswordChecklistView) content.findViewById(R.id.newPasswordChecklist)).follow(newInput, newCheck);
        LiveValidation[] passwordChecks = {
                new LiveValidation(content.findViewById(R.id.currentPasswordLayout),
                        value -> value.isEmpty() ? getString(R.string.password_error_current_required) : null),
                newCheck,
                new LiveValidation(content.findViewById(R.id.confirmNewPasswordLayout),
                        value -> AccountRules.confirmPasswordError(this, value, textOf(newInput)))
                        .alsoFollow(newInput)
        };

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(R.string.profile_change_password)
                .setView(content)
                .setPositiveButton(R.string.profile_change_password, null)
                .setNegativeButton(R.string.cancel, null)
                .create();
        // Replaces the default click handling so a failed attempt doesn't close the dialog
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            DialogUtils.hideError(content);
            // Local checks only save a round trip; "different from current" and the current-password check belong to the API
            if (LiveValidation.validateAll(passwordChecks)) {
                changePassword(dialog, content, textOf(currentInput), textOf(newInput));
            }
        }));
        dialog.show();
    }

    private void changePassword(AlertDialog dialog, View content, String current, String next) {
        // Sends the change; a wrong current password comes back as a 400, so it never signs the user out
        DialogUtils.setBusy(dialog, content, true, R.string.password_changing, R.string.profile_change_password);
        passwordCall = NetworkManager.getInstance().getApiService()
                .changePassword(prosumerNic, new ChangePasswordRequest(current, next));
        final Call<ApiResponse<Void>> call = passwordCall;
        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<Void>> request,
                                   @NonNull Response<ApiResponse<Void>> response) {
                // Closes the dialog on success (the current token stays valid), otherwise shows the API's reason in it
                if (isStale(call, passwordCall)) {
                    return;
                }
                if (response.isSuccessful()) {
                    dialog.dismiss();
                    Snackbar.make(findViewById(R.id.profileRoot), R.string.password_changed, Snackbar.LENGTH_SHORT).show();
                } else {
                    DialogUtils.setBusy(dialog, content, false, R.string.password_changing, R.string.profile_change_password);
                    DialogUtils.showError(content, ApiErrorParser.getMessage(ProfileActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<Void>> request, @NonNull Throwable t) {
                // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                if (isStale(call, passwordCall)) {
                    return;
                }
                DialogUtils.setBusy(dialog, content, false, R.string.password_changing, R.string.profile_change_password);
                DialogUtils.showError(content, getString(R.string.error_network));
            }
        });
    }

    // ---------------------------------------------------------------- Deactivate

    private void showDeactivateDialog() {
        // Confirms deactivation, spelling out that only a Backoffice officer can undo it, with an optional reason
        View content = LayoutInflater.from(this).inflate(R.layout.dialog_deactivate_account, null);
        TextInputEditText reasonInput = content.findViewById(R.id.reasonInput);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(R.string.deactivate_title)
                .setView(content)
                .setPositiveButton(R.string.deactivate_confirm, null)
                .setNegativeButton(R.string.cancel, null)
                .create();
        dialog.setOnShowListener(d -> {
            Button confirm = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            // Red confirm button, matching the destructive action on the screen
            confirm.setTextColor(ContextCompat.getColor(this, R.color.alert_danger));
            confirm.setOnClickListener(v -> {
                DialogUtils.hideError(content);
                String reason = textOf(reasonInput).trim();
                deactivate(dialog, content, reason.isEmpty() ? null : reason);
            });
        });
        dialog.show();
    }

    private void deactivate(AlertDialog dialog, View content, String reason) {
        // Deactivates the account; on success the session is cleared and the app returns to login
        DialogUtils.setBusy(dialog, content, true, R.string.deactivate_working, R.string.deactivate_confirm);
        deactivateCall = NetworkManager.getInstance().getApiService()
                .deactivateAccount(prosumerNic, new DeactivateAccountRequest(reason));
        final Call<ApiResponse<Void>> call = deactivateCall;
        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<Void>> request,
                                   @NonNull Response<ApiResponse<Void>> response) {
                // Signs out once the API confirms; the account can't be used again until Backoffice reactivates it
                if (isStale(call, deactivateCall)) {
                    return;
                }
                if (response.isSuccessful()) {
                    dialog.dismiss();
                    // A Toast outlives this screen, so the message is still visible on the login screen
                    Toast.makeText(getApplicationContext(), R.string.deactivate_done, Toast.LENGTH_LONG).show();
                    SessionManager.getInstance().endSession(() -> Navigator.openLogin(ProfileActivity.this, false));
                } else {
                    DialogUtils.setBusy(dialog, content, false, R.string.deactivate_working, R.string.deactivate_confirm);
                    DialogUtils.showError(content, ApiErrorParser.getMessage(ProfileActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<Void>> request, @NonNull Throwable t) {
                // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                if (isStale(call, deactivateCall)) {
                    return;
                }
                DialogUtils.setBusy(dialog, content, false, R.string.deactivate_working, R.string.deactivate_confirm);
                DialogUtils.showError(content, getString(R.string.error_network));
            }
        });
    }

    // ---------------------------------------------------------------- General helpers

    private boolean isStale(Call<?> call, Call<?> latest) {
        // True when the screen is closing or a newer request has replaced this one
        return isFinishing() || isDestroyed() || call != latest || call.isCanceled();
    }

    private static void cancel(Call<?> call) {
        // Cancels a request if one is running
        if (call != null) {
            call.cancel();
        }
    }

    private static String nullToEmpty(String value) {
        // Treats a missing profile field as blank
        return value == null ? "" : value;
    }

    private static String textOf(TextInputEditText input) {
        // Reads a field's text, treating an empty field as ""
        Editable text = input.getText();
        return text == null ? "" : text.toString();
    }
}

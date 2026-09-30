// File: LoginActivity.java
// Purpose: Login screen for Prosumers (NIC) and Grid Operators (username) using POST /api/users/login.
// Author: IT23215856, IT23218512 (registration link, deactivated-account dialogs)

package com.example.smart_solar_mobile.activities;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.TextView;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionEntity;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.AuthResponseData;
import com.example.smart_solar_mobile.models.LoginRequest;
import com.example.smart_solar_mobile.models.ReactivationRequest;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorBody;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.DialogUtils;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.checkbox.MaterialCheckBox;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {
    private static final String STATE_PROSUMER_SELECTED = "prosumer_selected";

    private boolean prosumerSelected = true;

    private MaterialButton roleProsumerButton;
    private MaterialButton roleOperatorButton;
    private MaterialButton signInButton;
    private TextView identifierLabel;
    private TextView operatorNotice;
    private TextView errorText;
    private View errorBanner;
    private TextInputLayout identifierLayout;
    private TextInputLayout passwordLayout;
    private TextInputEditText identifierInput;
    private TextInputEditText passwordInput;
    private MaterialCheckBox rememberMeCheck;
    private View registerPrompt;
    private Call<ApiResponse<Void>> reactivationCall;

    // Opens registration and, when an account was created, comes back with its NIC filled in
    private final ActivityResultLauncher<Intent> registerLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), this::onRegisterResult);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds the login screen and wires up the role toggle and sign-in button
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.loginRoot));

        roleProsumerButton = findViewById(R.id.roleProsumerButton);
        roleOperatorButton = findViewById(R.id.roleOperatorButton);
        signInButton = findViewById(R.id.signInButton);
        identifierLabel = findViewById(R.id.identifierLabel);
        operatorNotice = findViewById(R.id.operatorNotice);
        errorText = findViewById(R.id.errorText);
        errorBanner = findViewById(R.id.errorBanner);
        identifierLayout = findViewById(R.id.identifierLayout);
        passwordLayout = findViewById(R.id.passwordLayout);
        identifierInput = findViewById(R.id.identifierInput);
        passwordInput = findViewById(R.id.passwordInput);
        rememberMeCheck = findViewById(R.id.rememberMeCheck);
        registerPrompt = findViewById(R.id.registerPrompt);

        findViewById(R.id.registerLink).setOnClickListener(v ->
                registerLauncher.launch(new Intent(this, RegisterActivity.class)));
        roleProsumerButton.setOnClickListener(v -> selectRole(true));
        roleOperatorButton.setOnClickListener(v -> selectRole(false));
        signInButton.setOnClickListener(v -> attemptLogin());
        passwordInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                attemptLogin();
                return true;
            }
            return false;
        });

        if (savedInstanceState != null) {
            prosumerSelected = savedInstanceState.getBoolean(STATE_PROSUMER_SELECTED, true);
        }
        selectRole(prosumerSelected);

        if (getIntent().getBooleanExtra(Navigator.EXTRA_SESSION_EXPIRED, false)) {
            showError(getString(R.string.login_session_expired));
        }
    }

    @Override
    protected void onDestroy() {
        // Drops an in-flight reactivation request so its reply can't touch a closed screen
        if (reactivationCall != null) {
            reactivationCall.cancel();
        }
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Keeps the selected role when the screen is rotated
        super.onSaveInstanceState(outState);
        outState.putBoolean(STATE_PROSUMER_SELECTED, prosumerSelected);
    }

    private void selectRole(boolean prosumer) {
        // Switches the identifier field between NIC (Prosumer) and username (Grid Operator)
        prosumerSelected = prosumer;
        roleProsumerButton.setSelected(prosumer);
        roleOperatorButton.setSelected(!prosumer);
        identifierLabel.setText(prosumer ? R.string.login_label_nic : R.string.login_label_username);
        identifierInput.setHint(prosumer ? R.string.login_hint_nic : R.string.login_hint_username);
        identifierLayout.setStartIconDrawable(prosumer ? R.drawable.ic_badge : R.drawable.ic_person);
        identifierLayout.setError(null);
        operatorNotice.setVisibility(prosumer ? View.GONE : View.VISIBLE);
        registerPrompt.setVisibility(prosumer ? View.VISIBLE : View.GONE);
    }

    private void onRegisterResult(ActivityResult result) {
        // After a successful registration, fills in the new NIC so the Prosumer only has to type the password
        Intent data = result.getData();
        if (result.getResultCode() != RESULT_OK || data == null) {
            return;
        }
        String nic = data.getStringExtra(RegisterActivity.EXTRA_REGISTERED_NIC);
        selectRole(true);
        hideError();
        identifierInput.setText(nic);
        passwordInput.setText(null);
        passwordInput.requestFocus();
        Snackbar.make(findViewById(R.id.loginRoot), R.string.login_registered, Snackbar.LENGTH_LONG).show();
    }

    private void attemptLogin() {
        // Checks both fields are filled in, then sends the credentials to the API
        String identifier = textOf(identifierInput).trim();
        String password = textOf(passwordInput);

        identifierLayout.setError(null);
        passwordLayout.setError(null);
        hideError();

        // Empty-field checks are only a convenience; the API validates the credentials
        boolean valid = true;
        if (identifier.isEmpty()) {
            identifierLayout.setError(getString(prosumerSelected
                    ? R.string.login_error_nic_required
                    : R.string.login_error_username_required));
            valid = false;
        }
        if (password.isEmpty()) {
            passwordLayout.setError(getString(R.string.login_error_password_required));
            valid = false;
        }
        if (!valid) {
            return;
        }

        setLoading(true);
        NetworkManager.getInstance().getApiService()
                .login(new LoginRequest(identifier, password))
                .enqueue(new Callback<ApiResponse<AuthResponseData>>() {
                    @Override
                    public void onResponse(@NonNull Call<ApiResponse<AuthResponseData>> call,
                                           @NonNull Response<ApiResponse<AuthResponseData>> response) {
                        // Opens the home screen on success, otherwise shows the API's reason
                        if (isFinishing() || isDestroyed()) {
                            return;
                        }
                        ApiResponse<AuthResponseData> body = response.body();
                        if (response.isSuccessful() && body != null && body.data != null) {
                            handleLoginSuccess(body.data);
                        } else {
                            // parseError keeps the extra fields a deactivated Prosumer's 401 carries
                            setLoading(false);
                            ApiErrorBody error = ApiErrorParser.parseError(LoginActivity.this, response);
                            showError(error.message);
                            if (error.isAccountDeactivated()) {
                                showDeactivatedDialog(identifier, password, error);
                            }
                        }
                    }

                    @Override
                    public void onFailure(@NonNull Call<ApiResponse<AuthResponseData>> call, @NonNull Throwable t) {
                        // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                        if (isFinishing() || isDestroyed()) {
                            return;
                        }
                        setLoading(false);
                        showError(getString(R.string.error_network));
                    }
                });
    }

    private void showDeactivatedDialog(String nic, String password, ApiErrorBody error) {
        // Two dialogs driven by the API's reply: offer a reactivation request, or show the one already waiting
        boolean pending = error.reactivationRequested;
        View content = LayoutInflater.from(this).inflate(R.layout.dialog_account_deactivated, null);
        ((TextView) content.findViewById(R.id.dialogBodyText))
                .setText(pending ? R.string.pending_body : R.string.deactivated_body);
        // The decline reason only matters while no new request is waiting
        if (!pending && error.rejectionReason != null && !error.rejectionReason.trim().isEmpty()) {
            ((TextView) content.findViewById(R.id.declinedReasonText)).setText(error.rejectionReason.trim());
            content.findViewById(R.id.declinedBox).setVisibility(View.VISIBLE);
        }

        int actionText = pending ? R.string.pending_cancel_request : R.string.deactivated_request;
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(pending ? R.string.pending_title : R.string.deactivated_title)
                .setView(content)
                .setPositiveButton(actionText, null)
                .setNegativeButton(pending ? R.string.pending_close : R.string.deactivated_not_now, null)
                .create();
        // Replaces the default click handling so a failed attempt keeps the dialog open with the reason shown
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            DialogUtils.hideError(content);
            sendReactivationChange(dialog, content, nic, password, pending, actionText);
        }));
        dialog.show();
    }

    private void sendReactivationChange(AlertDialog dialog, View content, String nic, String password,
                                        boolean pending, int actionText) {
        // No token exists for a deactivated account, so the NIC and password already typed authenticate the call
        DialogUtils.setBusy(dialog, content, true,
                pending ? R.string.pending_cancelling : R.string.deactivated_requesting, actionText);
        ReactivationRequest credentials = new ReactivationRequest(nic, password);
        reactivationCall = pending
                ? NetworkManager.getInstance().getApiService().cancelReactivationRequest(credentials)
                : NetworkManager.getInstance().getApiService().requestReactivation(credentials);
        final Call<ApiResponse<Void>> call = reactivationCall;
        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<Void>> request,
                                   @NonNull Response<ApiResponse<Void>> response) {
                // Closes the dialog and confirms the new state, or shows the API's reason inside the dialog
                if (isFinishing() || isDestroyed() || call != reactivationCall || call.isCanceled()) {
                    return;
                }
                if (response.isSuccessful()) {
                    dialog.dismiss();
                    Snackbar.make(findViewById(R.id.loginRoot),
                            pending ? R.string.pending_cancelled : R.string.deactivated_requested,
                            Snackbar.LENGTH_LONG).show();
                } else {
                    DialogUtils.setBusy(dialog, content, false,
                            pending ? R.string.pending_cancelling : R.string.deactivated_requesting, actionText);
                    DialogUtils.showError(content, ApiErrorParser.getMessage(LoginActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<Void>> request, @NonNull Throwable t) {
                // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                if (isFinishing() || isDestroyed() || call != reactivationCall || call.isCanceled()) {
                    return;
                }
                DialogUtils.setBusy(dialog, content, false,
                        pending ? R.string.pending_cancelling : R.string.deactivated_requesting, actionText);
                DialogUtils.showError(content, getString(R.string.error_network));
            }
        });
    }

    private void handleLoginSuccess(AuthResponseData data) {
        // Saves the session and opens the home screen for the role the API returned
        boolean supportedRole = Roles.PROSUMER.equals(data.role) || Roles.GRID_OPERATOR.equals(data.role);
        if (!supportedRole || data.token == null || data.token.isEmpty()) {
            setLoading(false);
            showError(getString(R.string.login_error_role_not_supported));
            return;
        }

        SessionEntity session = new SessionEntity(data.token, data.role, data.identifier, data.fullName);
        SessionManager.getInstance().startSession(session, rememberMeCheck.isChecked(),
                () -> Navigator.openHome(this, data.role));
    }

    private void setLoading(boolean loading) {
        // Locks the form while the request is in flight so it can't be sent twice
        signInButton.setEnabled(!loading);
        signInButton.setText(loading ? R.string.login_signing_in : R.string.login_sign_in);
        roleProsumerButton.setEnabled(!loading);
        roleOperatorButton.setEnabled(!loading);
        identifierInput.setEnabled(!loading);
        passwordInput.setEnabled(!loading);
        rememberMeCheck.setEnabled(!loading);
    }

    private void showError(String message) {
        // Shows the message in the red banner above the Sign In button
        errorText.setText(message);
        errorBanner.setVisibility(View.VISIBLE);
    }

    private void hideError() {
        // Hides the red error banner
        errorBanner.setVisibility(View.GONE);
    }

    private static String textOf(TextInputEditText input) {
        // Reads a field's text, treating an empty field as ""
        Editable text = input.getText();
        return text == null ? "" : text.toString();
    }
}

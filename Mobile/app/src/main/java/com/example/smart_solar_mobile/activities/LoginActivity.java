// File: LoginActivity.java
// Purpose: Login screen for Prosumers (NIC) and Grid Operators (username) using POST /api/users/login.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.os.Bundle;
import android.text.Editable;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionEntity;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.AuthResponseData;
import com.example.smart_solar_mobile.models.LoginRequest;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.checkbox.MaterialCheckBox;
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
                            setLoading(false);
                            showError(ApiErrorParser.getMessage(LoginActivity.this, response));
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

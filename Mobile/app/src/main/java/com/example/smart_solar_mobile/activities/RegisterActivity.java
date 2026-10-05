// File: RegisterActivity.java
// Purpose: Prosumer registration with NIC as the primary key, using POST /api/users/register.
// Author: IT23218512

package com.example.smart_solar_mobile.activities;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.models.RegisterRequest;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.AccountRules;
import com.example.smart_solar_mobile.utils.AllowedInput;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.utils.LiveValidation;
import com.example.smart_solar_mobile.views.PasswordChecklistView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {
    // Result extra: the NIC just registered, so the login screen can fill it in
    public static final String EXTRA_REGISTERED_NIC = "registered_nic";

    private MaterialButton registerButton;
    private TextView errorText;
    private View errorBanner;
    private TextInputEditText nicInput;
    private TextInputEditText fullNameInput;
    private TextInputEditText emailInput;
    private TextInputEditText phoneInput;
    private TextInputEditText passwordInput;
    private TextInputEditText confirmPasswordInput;
    private LiveValidation[] fieldChecks;

    private Call<ApiResponse<Void>> registerCall;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds the registration form and wires up the submit button and the link back to sign in
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.registerRoot));

        registerButton = findViewById(R.id.registerButton);
        errorText = findViewById(R.id.errorText);
        errorBanner = findViewById(R.id.errorBanner);
        nicInput = findViewById(R.id.nicInput);
        fullNameInput = findViewById(R.id.fullNameInput);
        emailInput = findViewById(R.id.emailInput);
        phoneInput = findViewById(R.id.phoneInput);
        passwordInput = findViewById(R.id.passwordInput);
        confirmPasswordInput = findViewById(R.id.confirmPasswordInput);
        setUpFieldChecks();

        registerButton.setOnClickListener(v -> attemptRegister());
        findViewById(R.id.signInLink).setOnClickListener(v -> finish());
        confirmPasswordInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                attemptRegister();
                return true;
            }
            return false;
        });
    }

    @Override
    protected void onDestroy() {
        // Drops an in-flight request so its reply can't touch a closed screen
        if (registerCall != null) {
            registerCall.cancel();
        }
        super.onDestroy();
    }

    private void setUpFieldChecks() {
        // Blocks characters each field doesn't accept, and shows each field's message once it has been left, then live as it changes
        AllowedInput.restrict(nicInput, AllowedInput.NIC);
        AllowedInput.restrict(fullNameInput, AllowedInput.FULL_NAME);
        AllowedInput.restrict(emailInput, AllowedInput.NO_SPACES);
        AllowedInput.restrict(phoneInput, AllowedInput.PHONE);
        AllowedInput.restrict(passwordInput, AllowedInput.NO_SPACES);
        AllowedInput.restrict(confirmPasswordInput, AllowedInput.NO_SPACES);

        LiveValidation passwordCheck = new LiveValidation(findViewById(R.id.passwordLayout),
                value -> AccountRules.newPasswordError(this, value, R.string.login_error_password_required));
        ((PasswordChecklistView) findViewById(R.id.passwordChecklist)).follow(passwordInput, passwordCheck);

        fieldChecks = new LiveValidation[]{
                new LiveValidation(findViewById(R.id.nicLayout), value -> AccountRules.nicError(this, value)),
                new LiveValidation(findViewById(R.id.fullNameLayout), value -> AccountRules.fullNameError(this, value)),
                new LiveValidation(findViewById(R.id.emailLayout), value -> AccountRules.emailError(this, value)),
                new LiveValidation(findViewById(R.id.phoneLayout), value -> AccountRules.phoneError(this, value)),
                passwordCheck,
                new LiveValidation(findViewById(R.id.confirmPasswordLayout),
                        value -> AccountRules.confirmPasswordError(this, value, textOf(passwordInput)))
                        .alsoFollow(passwordInput)
        };
    }

    private void attemptRegister() {
        // Checks every field against the account rules, then sends the details to the API
        hideError();
        // These checks only save a round trip; the API applies the same rules, and a duplicate NIC is only known there
        if (!LiveValidation.validateAll(fieldChecks)) {
            return;
        }

        String nic = textOf(nicInput).trim();
        String fullName = textOf(fullNameInput).trim();
        String email = textOf(emailInput).trim();
        String phone = textOf(phoneInput).trim();
        String password = textOf(passwordInput);

        setLoading(true);
        registerCall = NetworkManager.getInstance().getApiService()
                .register(new RegisterRequest(nic, password, fullName, email, phone));
        registerCall.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<Void>> call,
                                   @NonNull Response<ApiResponse<Void>> response) {
                // Returns to login on success, otherwise shows the API's reason
                if (isFinishing() || isDestroyed() || call.isCanceled()) {
                    return;
                }
                if (response.isSuccessful()) {
                    finishWithRegisteredNic(nic);
                } else {
                    setLoading(false);
                    showError(ApiErrorParser.getMessage(RegisterActivity.this, response));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<Void>> call, @NonNull Throwable t) {
                // The request never reached the API (no connection, wrong API_BASE_URL, server down)
                if (isFinishing() || isDestroyed() || call.isCanceled()) {
                    return;
                }
                setLoading(false);
                showError(getString(R.string.error_network));
            }
        });
    }

    private void finishWithRegisteredNic(String nic) {
        // Goes back to login with the new NIC rather than signing in, so the first sign-in is deliberate
        Intent result = new Intent().putExtra(EXTRA_REGISTERED_NIC, nic);
        setResult(RESULT_OK, result);
        finish();
    }

    private void setLoading(boolean loading) {
        // Locks the form while the request is in flight so it can't be sent twice
        registerButton.setEnabled(!loading);
        registerButton.setText(loading ? R.string.register_submitting : R.string.register_submit);
        nicInput.setEnabled(!loading);
        fullNameInput.setEnabled(!loading);
        emailInput.setEnabled(!loading);
        phoneInput.setEnabled(!loading);
        passwordInput.setEnabled(!loading);
        confirmPasswordInput.setEnabled(!loading);
    }

    private void showError(String message) {
        // Shows the message in the red banner above the Create Account button
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

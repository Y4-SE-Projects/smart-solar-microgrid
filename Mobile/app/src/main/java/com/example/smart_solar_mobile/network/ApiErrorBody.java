// File: ApiErrorBody.java
// Purpose: The full error body an API call can return, including the extra fields sent when a deactivated Prosumer tries to sign in.
// Author: IT23218512

package com.example.smart_solar_mobile.network;

public class ApiErrorBody {
    // "code" value on the 401 a deactivated Prosumer gets from POST /api/users/login/prosumer
    public static final String CODE_ACCOUNT_DEACTIVATED = "ACCOUNT_DEACTIVATED";

    public boolean success;
    // Always filled in by ApiErrorParser.parseError, falling back to a status-code message
    public String message;

    // The fields below are only sent with CODE_ACCOUNT_DEACTIVATED
    public String code;
    // True when a reactivation request is already waiting for Backoffice
    public boolean reactivationRequested;
    // Why Backoffice declined the last request; null if it was never declined
    public String rejectionReason;

    public boolean isAccountDeactivated() {
        // True when the login failed because this Prosumer account is deactivated
        return CODE_ACCOUNT_DEACTIVATED.equals(code);
    }
}

// File: ApiErrorBody.java
// Purpose: The full error body an API call can return, including the extra fields sent when a deactivated Prosumer tries to sign in.
// Author: IT23218512

package com.example.smart_solar_mobile.network;

import com.example.smart_solar_mobile.models.Roles;

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
    // True whenever Backoffice declined the last request, even when it gave no reason
    public boolean reactivationDeclined;
    // Why Backoffice declined the last request; null if it was never declined or no reason was given
    public String rejectionReason;
    // Who deactivated the account: "Prosumer" ( themselves ) or "Backoffice"
    public String deactivatedBy;
    // The reason Backoffice gave when deactivating; only sent when deactivatedBy is "Backoffice"
    public String deactivationReason;

    public boolean isAccountDeactivated() {
        // True when the login failed because this Prosumer account is deactivated
        return CODE_ACCOUNT_DEACTIVATED.equals(code);
    }

    public boolean isDeactivatedByBackoffice() {
        // True when Backoffice, not the Prosumer, switched the account off
        return Roles.BACKOFFICE.equals(deactivatedBy);
    }
}

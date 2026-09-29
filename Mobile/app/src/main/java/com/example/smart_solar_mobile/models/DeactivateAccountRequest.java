// File: DeactivateAccountRequest.java
// Purpose: Request body for PUT /api/users/{nic}/deactivate, a Prosumer deactivating their own account.
// Author: IT23218512

package com.example.smart_solar_mobile.models;

public class DeactivateAccountRequest {
    // Optional; null is left out of the JSON, and the API stores a blank reason as no reason
    public String reason;

    public DeactivateAccountRequest(String reason) {
        // Stores the reason the Prosumer gave, if any
        this.reason = reason;
    }
}

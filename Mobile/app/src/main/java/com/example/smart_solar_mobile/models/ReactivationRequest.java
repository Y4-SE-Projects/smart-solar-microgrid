// File: ReactivationRequest.java
// Purpose: Request body for POST /api/users/reactivation-request and its /cancel counterpart.
// Author: IT23218512

package com.example.smart_solar_mobile.models;

public class ReactivationRequest {
    // A deactivated account has no token, so the NIC and password in the body are what authenticate the call
    public String nic;
    public String password;

    public ReactivationRequest(String nic, String password) {
        // Stores the credentials already typed on the login screen
        this.nic = nic;
        this.password = password;
    }
}

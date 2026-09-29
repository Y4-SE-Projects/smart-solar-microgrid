// File: ChangePasswordRequest.java
// Purpose: Request body for PUT /api/users/{nic}/password, a Prosumer changing their own password.
// Author: IT23218512

package com.example.smart_solar_mobile.models;

public class ChangePasswordRequest {
    public String currentPassword;
    public String newPassword;

    public ChangePasswordRequest(String currentPassword, String newPassword) {
        // Stores the current password (proof of ownership) and the replacement
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
    }
}

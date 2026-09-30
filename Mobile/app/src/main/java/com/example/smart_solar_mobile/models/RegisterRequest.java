// File: RegisterRequest.java
// Purpose: Request body for POST /api/users/register when a Prosumer signs up from the mobile app.
// Author: IT23218512

package com.example.smart_solar_mobile.models;

public class RegisterRequest {
    // Always Prosumer: staff accounts are created by Backoffice on the web, never from mobile
    public String role = Roles.PROSUMER;
    public String nic;
    public String password;
    public String fullName;
    public String email;
    public String phone;

    public RegisterRequest(String nic, String password, String fullName, String email, String phone) {
        // Stores the details typed on the registration screen
        this.nic = nic;
        this.password = password;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
    }
}

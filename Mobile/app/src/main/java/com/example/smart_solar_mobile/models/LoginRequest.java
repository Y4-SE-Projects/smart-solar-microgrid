// File: LoginRequest.java
// Purpose: Request body for POST /api/users/login.
// Author: IT23215856

package com.example.smart_solar_mobile.models;

public class LoginRequest {
    // NIC for Prosumers, username for Grid Operators
    public String identifier;
    public String password;

    public LoginRequest(String identifier, String password) {
        // Stores the credentials typed on the login screen
        this.identifier = identifier;
        this.password = password;
    }
}

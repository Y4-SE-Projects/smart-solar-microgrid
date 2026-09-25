// File: AuthResponseData.java
// Purpose: The "data" part of a successful login response (matches the API's AuthResponseData DTO).
// Author: IT23215856

package com.example.smart_solar_mobile.models;

public class AuthResponseData {
    public String token;
    public String role;
    // NIC for Prosumers, username for Grid Operators
    public String identifier;
    public String fullName;
}

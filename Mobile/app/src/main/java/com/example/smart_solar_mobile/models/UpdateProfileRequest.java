// File: UpdateProfileRequest.java
// Purpose: Request body for PUT /api/users/{nic}, a Prosumer editing their own profile.
// Author: IT23218512

package com.example.smart_solar_mobile.models;

public class UpdateProfileRequest {
    // NIC and role are deliberately absent: neither can be changed
    public String fullName;
    public String email;
    public String phone;

    public UpdateProfileRequest(String fullName, String email, String phone) {
        // Stores the edited contact details
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
    }
}

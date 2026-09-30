// File: UserProfile.java
// Purpose: The "data" part of GET /api/users/{nic} (matches the API's UserProfileResponse DTO).
// Author: IT23218512

package com.example.smart_solar_mobile.models;

public class UserProfile {
    // Account states exactly as the API sends them in "status"
    public static final String STATUS_ACTIVE = "Active";
    public static final String STATUS_DEACTIVATED = "Deactivated";
    public static final String STATUS_PENDING_REACTIVATION = "PendingReactivation";

    public String nic;
    public String fullName;
    public String email;
    public String phone;
    public boolean isActive;
    // Dates are kept as the API's ISO text and formatted only where they are shown
    public String createdAt;
    // Worked out on the server from isActive and reactivationRequestedAt, so the app never re-derives it
    public String status;

    // Only filled while the account is, or was, deactivated
    public String deactivationReason;
    public String deactivatedAt;
    public Integer daysElapsed;

    // Only filled while a reactivation request is waiting for Backoffice
    public String reactivationRequestedAt;
    public Integer daysSinceRequest;
}

// File: ReservationData.java
// Purpose: Reservation data returned by the Member 03 lifecycle and pending endpoints.

package com.example.smart_solar_mobile.models;

public class ReservationData {
    public String reservationId;
    public String prosumerNic;
    public String stationId;
    // Display-only station reference; stationId remains the API identity for all actions.
    public String stationName;
    public String slotId;
    public String scheduledTime;
    public String status;
    public String qrCodeData;
    public String createdAt;
    public String updatedAt;
}

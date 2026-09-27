// File: CreateReservationRequest.java
// Purpose: Request body for a Prosumer creating a reservation through POST /api/reservations.

package com.example.smart_solar_mobile.models;

public class CreateReservationRequest {
    public String stationId;
    public String slotId;
    public String scheduledTime;

    public CreateReservationRequest(String stationId, String slotId, String scheduledTime) {
        // Stores the selected station, slot and slot start time for the API request.
        this.stationId = stationId;
        this.slotId = slotId;
        this.scheduledTime = scheduledTime;
    }
}
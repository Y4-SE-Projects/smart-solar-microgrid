// File: UpdateReservationRequest.java
// Purpose: Editable reservation fields accepted by PUT /api/reservations/{id}.

package com.example.smart_solar_mobile.models;

public class UpdateReservationRequest {
    public String stationId;
    public String slotId;
    public String scheduledTime;

    public UpdateReservationRequest(String stationId, String slotId, String scheduledTime) {
        // Stores the replacement selection for the API request.
        this.stationId = stationId;
        this.slotId = slotId;
        this.scheduledTime = scheduledTime;
    }
}
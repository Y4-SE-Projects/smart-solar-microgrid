// File: SetSlotAvailabilityRequest.java
// Purpose: Request body for PUT /api/slots/{slotId}/availability.
// Author: IT23215856

package com.example.smart_solar_mobile.models;

public class SetSlotAvailabilityRequest {
    public boolean isAvailable;

    public SetSlotAvailabilityRequest(boolean isAvailable) {
        // Stores the availability the operator is switching the slot to
        this.isAvailable = isAvailable;
    }
}

// File: EnergyBookingSlot.java
// Purpose: A bookable time slot at a station, as returned by GET /api/stations/{stationId}/slots.
// Author: IT23215856

package com.example.smart_solar_mobile.models;

public class EnergyBookingSlot {
    // Mongo ObjectId; unlike slotId it is always unique
    public String id;
    public String slotId;
    public String stationId;
    // UTC ISO-8601 timestamps; parse with TimeUtils.parseApiDate
    public String startTime;
    public String endTime;
    public boolean isAvailable;
}

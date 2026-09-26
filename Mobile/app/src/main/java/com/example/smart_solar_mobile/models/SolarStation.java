// File: SolarStation.java
// Purpose: A microgrid station as returned by GET /api/stations (SolarStationInfo collection).
// Author: IT23215856

package com.example.smart_solar_mobile.models;

import java.io.Serializable;

// Serializable so a station can be handed to another screen in an Intent
public class SolarStation implements Serializable {
    private static final long serialVersionUID = 1L;

    // Mongo ObjectId as a string; stationId is the human-readable ID used in routes
    public String id;
    public String stationId;
    public String name;
    public double latitude;
    public double longitude;
    public double capacityKWh;
    public int batterySlotCount;
    // Daily operating hours, "HH:mm-HH:mm" in local time
    public String schedule;
    public boolean isActive;
    public String createdAt;
}

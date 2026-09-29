// File: VerifyQrResponse.java
// Purpose: Response for POST /api/reservations/verify-qr — the server's verdict on a scanned QR.
// The app only ever displays these fields; it never decides validity itself.

package com.example.smart_solar_mobile.models;

public class VerifyQrResponse {
    public String reservationId;
    public String status;
    public String verifiedAt;
    public String result;
    public boolean alreadyProcessed;
    public String prosumerNic;
    public String prosumerName;
    public String stationId;
    public String scheduledTime;
}

// File: QrResponse.java
// Purpose: Response for GET/PUT .../qr — the signed QR payload plus its validity window. Owner-only.

package com.example.smart_solar_mobile.models;

public class QrResponse {
    public String reservationId;
    public String qrCodeData;
    public String scheduledTime;
    public String validFrom;
    public String expiresAt;
}

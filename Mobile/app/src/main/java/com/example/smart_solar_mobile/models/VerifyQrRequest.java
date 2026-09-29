// File: VerifyQrRequest.java
// Purpose: Request body for POST /api/reservations/verify-qr. The operator's identity comes
// from the JWT, never from this body — only the raw decoded QR text is sent.

package com.example.smart_solar_mobile.models;

public class VerifyQrRequest {
    public String qrCodeData;

    public VerifyQrRequest(String qrCodeData) {
        this.qrCodeData = qrCodeData;
    }
}

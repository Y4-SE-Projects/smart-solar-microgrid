// File: QrScanEntryResponse.java
// Purpose: One row of GET /api/reservations/qr-scans/recent — a past scan by the current operator.

package com.example.smart_solar_mobile.models;

public class QrScanEntryResponse {
    public String reservationId;
    public String at;
    public String operator;
    public String result;
    public String reason;
}

// File: ReservationCacheEntity.java
// Purpose: Last-known reservation display fields, scoped to one authenticated Prosumer.

package com.example.smart_solar_mobile.db;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.Ignore;

import com.example.smart_solar_mobile.models.ReservationData;

@Entity(tableName = "reservation_cache", primaryKeys = {"prosumerNic", "reservationId"})
public class ReservationCacheEntity {
    @NonNull public String prosumerNic = "";
    @NonNull public String reservationId = "";
    public String stationId;
    public String slotId;
    public String scheduledTime;
    public String status;
    public String createdAt;
    public String updatedAt;
    public long lastSyncedAt;

    public ReservationCacheEntity() {
        // Room reads cached display rows with this constructor.
    }

    @Ignore
    public ReservationCacheEntity(@NonNull String nic, @NonNull ReservationData source, long syncedAt) {
        // The cache owner comes from the authenticated session, never from the API row.
        prosumerNic = nic;
        reservationId = source.reservationId;
        stationId = source.stationId;
        slotId = source.slotId;
        scheduledTime = source.scheduledTime;
        status = source.status;
        createdAt = source.createdAt;
        updatedAt = source.updatedAt;
        lastSyncedAt = syncedAt;
    }

    public ReservationData toReservationData() {
        // QR payloads are deliberately absent; only the API can provide a current QR pass.
        ReservationData data = new ReservationData();
        data.prosumerNic = prosumerNic;
        data.reservationId = reservationId;
        data.stationId = stationId;
        data.slotId = slotId;
        data.scheduledTime = scheduledTime;
        data.status = status;
        data.createdAt = createdAt;
        data.updatedAt = updatedAt;
        return data;
    }
}

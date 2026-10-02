// File: ReservationCacheDao.java
// Purpose: Atomically replaces one Prosumer's last-known complete reservation history.

package com.example.smart_solar_mobile.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Transaction;

import com.example.smart_solar_mobile.models.ReservationData;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Dao
public abstract class ReservationCacheDao {
    @Query("SELECT * FROM reservation_cache WHERE prosumerNic = :nic ORDER BY createdAt DESC")
    public abstract List<ReservationCacheEntity> getForProsumer(String nic);

    @Query("DELETE FROM reservation_cache WHERE prosumerNic = :nic")
    protected abstract void deleteForProsumer(String nic);

    @Query("SELECT MAX(lastSyncedAt) FROM reservation_cache WHERE prosumerNic = :nic")
    protected abstract Long latestSyncForProsumer(String nic);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    protected abstract void insertAll(List<ReservationCacheEntity> rows);

    @Query("UPDATE reservation_cache SET stationName = :name "
            + "WHERE prosumerNic = :nic AND stationId = :stationId")
    protected abstract void updateStationName(String nic, String stationId, String name);

    @Transaction
    public void updateStationNamesForProsumer(String nic, Map<String, String> names) {
        // A later station response enriches only this Prosumer's existing display rows.
        for (Map.Entry<String, String> entry : names.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null
                    && !entry.getValue().trim().isEmpty()) {
                updateStationName(nic, entry.getKey(), entry.getValue());
            }
        }
    }

    @Transaction
    public void replaceForProsumer(String nic, List<ReservationData> reservations, long syncedAt) {
        // A successful complete history response replaces only this account's rows.
        Long existingSync = latestSyncForProsumer(nic);
        if (existingSync != null && existingSync > syncedAt) return;
        Map<String, String> existingNames = new HashMap<>();
        Map<String, String> existingStationNames = new HashMap<>();
        for (ReservationCacheEntity cached : getForProsumer(nic)) {
            if (cached.stationName != null && !cached.stationName.trim().isEmpty()) {
                existingNames.put(cached.reservationId, cached.stationName);
                if (cached.stationId != null) {
                    existingStationNames.put(cached.stationId, cached.stationName);
                }
            }
        }
        List<ReservationCacheEntity> rows = new ArrayList<>();
        for (ReservationData reservation : reservations) {
            if (reservation != null && nic.equals(reservation.prosumerNic)
                    && reservation.reservationId != null
                    && !reservation.reservationId.trim().isEmpty()) {
                ReservationCacheEntity row = new ReservationCacheEntity(nic, reservation, syncedAt);
                if (row.stationName == null || row.stationName.trim().isEmpty()) {
                    row.stationName = existingNames.get(row.reservationId);
                    if (row.stationName == null) {
                        row.stationName = existingStationNames.get(row.stationId);
                    }
                }
                rows.add(row);
            }
        }
        deleteForProsumer(nic);
        insertAll(rows);
    }
}

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
import java.util.List;

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

    @Transaction
    public void replaceForProsumer(String nic, List<ReservationData> reservations, long syncedAt) {
        // A successful complete history response replaces only this account's rows.
        Long existingSync = latestSyncForProsumer(nic);
        if (existingSync != null && existingSync > syncedAt) return;
        List<ReservationCacheEntity> rows = new ArrayList<>();
        for (ReservationData reservation : reservations) {
            if (reservation != null && nic.equals(reservation.prosumerNic)
                    && reservation.reservationId != null
                    && !reservation.reservationId.trim().isEmpty()) {
                rows.add(new ReservationCacheEntity(nic, reservation, syncedAt));
            }
        }
        deleteForProsumer(nic);
        insertAll(rows);
    }
}

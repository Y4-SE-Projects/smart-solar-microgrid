// File: DashboardCacheEntity.java
// Purpose: Last-known Prosumer dashboard counts for display while the API refreshes.

package com.example.smart_solar_mobile.db;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.Ignore;
import androidx.room.PrimaryKey;

@Entity(tableName = "dashboard_cache")
public class DashboardCacheEntity {
    @PrimaryKey
    @NonNull
    public String prosumerNic = "";
    public long pendingCount;
    public long approvedFutureCount;
    public long lastSyncedAt;

    public DashboardCacheEntity() {
        // Room uses this constructor when reading a cached row.
    }

    @Ignore
    public DashboardCacheEntity(@NonNull String prosumerNic, long pendingCount,
                                long approvedFutureCount, long lastSyncedAt) {
        // The caller supplies the authenticated NIC; cached data never selects an account.
        this.prosumerNic = prosumerNic;
        this.pendingCount = pendingCount;
        this.approvedFutureCount = approvedFutureCount;
        this.lastSyncedAt = lastSyncedAt;
    }
}

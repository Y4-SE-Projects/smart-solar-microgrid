// File: DashboardCacheDao.java
// Purpose: Reads and replaces last-known dashboard counts for one authenticated Prosumer.

package com.example.smart_solar_mobile.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

@Dao
public interface DashboardCacheDao {
    @Query("SELECT * FROM dashboard_cache WHERE prosumerNic = :prosumerNic LIMIT 1")
    DashboardCacheEntity getForProsumer(String prosumerNic);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void save(DashboardCacheEntity cache);
}

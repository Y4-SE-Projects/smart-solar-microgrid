// File: SessionDao.java
// Purpose: SQLite queries for reading, saving and clearing the session row.
// Author: IT23215856

package com.example.smart_solar_mobile.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

@Dao
public interface SessionDao {
    @Query("SELECT * FROM session WHERE id = 1 LIMIT 1")
    SessionEntity getSession();

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void saveSession(SessionEntity session);

    @Query("DELETE FROM session")
    void clearSession();
}

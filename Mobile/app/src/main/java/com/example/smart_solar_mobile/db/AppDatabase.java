// File: AppDatabase.java
// Purpose: The app's local SQLite database (local cache only; the API remains the source of truth).
// Author: IT23215856

package com.example.smart_solar_mobile.db;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;
import androidx.room.migration.Migration;
import androidx.sqlite.db.SupportSQLiteDatabase;

@Database(entities = {SessionEntity.class, DashboardCacheEntity.class,
        ReservationCacheEntity.class}, version = 3, exportSchema = false)
public abstract class AppDatabase extends RoomDatabase {
    private static volatile AppDatabase instance;
    private static final Migration MIGRATION_1_2 = new Migration(1, 2) {
        @Override
        public void migrate(SupportSQLiteDatabase database) {
            // Adds the account-scoped display cache without replacing the existing session table.
            database.execSQL("CREATE TABLE IF NOT EXISTS dashboard_cache "
                    + "(prosumerNic TEXT NOT NULL, pendingCount INTEGER NOT NULL, "
                    + "approvedFutureCount INTEGER NOT NULL, lastSyncedAt INTEGER NOT NULL, "
                    + "PRIMARY KEY(prosumerNic))");
        }
    };
    private static final Migration MIGRATION_2_3 = new Migration(2, 3) {
        @Override
        public void migrate(SupportSQLiteDatabase database) {
            // Keep the session and dashboard tables while adding account-scoped history.
            database.execSQL("CREATE TABLE IF NOT EXISTS reservation_cache "
                    + "(prosumerNic TEXT NOT NULL, reservationId TEXT NOT NULL, "
                    + "stationId TEXT, slotId TEXT, scheduledTime TEXT, status TEXT, "
                    + "createdAt TEXT, updatedAt TEXT, lastSyncedAt INTEGER NOT NULL, "
                    + "PRIMARY KEY(prosumerNic, reservationId))");
        }
    };

    public abstract SessionDao sessionDao();
    public abstract DashboardCacheDao dashboardCacheDao();
    public abstract ReservationCacheDao reservationCacheDao();

    public static AppDatabase getInstance(Context context) {
        // Opens the database once and reuses it for the life of the app
        if (instance == null) {
            synchronized (AppDatabase.class) {
                if (instance == null) {
                    // Apply both additive migrations without discarding saved sessions or counts.
                    instance = Room.databaseBuilder(context.getApplicationContext(), AppDatabase.class, "smart_solar.db")
                            .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                            .build();
                }
            }
        }
        return instance;
    }
}

// File: AppDatabase.java
// Purpose: The app's local SQLite database (local cache only; the API remains the source of truth).
// Author: IT23215856

package com.example.smart_solar_mobile.db;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

@Database(entities = {SessionEntity.class}, version = 1, exportSchema = false)
public abstract class AppDatabase extends RoomDatabase {
    private static volatile AppDatabase instance;

    public abstract SessionDao sessionDao();

    public static AppDatabase getInstance(Context context) {
        // Opens the database once and reuses it for the life of the app
        if (instance == null) {
            synchronized (AppDatabase.class) {
                if (instance == null) {
                    // Everything stored here is a copy of API data, so a schema change can safely wipe it
                    instance = Room.databaseBuilder(context.getApplicationContext(), AppDatabase.class, "smart_solar.db")
                            .fallbackToDestructiveMigration()
                            .build();
                }
            }
        }
        return instance;
    }
}

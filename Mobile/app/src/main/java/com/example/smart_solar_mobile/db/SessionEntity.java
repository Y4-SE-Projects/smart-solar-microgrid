// File: SessionEntity.java
// Purpose: SQLite table row holding the signed-in user's login details.
// Author: IT23215856

package com.example.smart_solar_mobile.db;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.Ignore;
import androidx.room.PrimaryKey;

@Entity(tableName = "session")
public class SessionEntity {
    // Only one user can be signed in, so the table only ever holds the row with id 1
    @PrimaryKey
    public int id = 1;

    @NonNull
    public String token = "";
    public String role;
    // NIC for Prosumers, username for Grid Operators
    public String identifier;
    public String fullName;

    public SessionEntity() {
        // Empty constructor Room uses when reading the row back
    }

    @Ignore
    public SessionEntity(@NonNull String token, String role, String identifier, String fullName) {
        // Builds a session from the login response
        this.token = token;
        this.role = role;
        this.identifier = identifier;
        this.fullName = fullName;
    }
}

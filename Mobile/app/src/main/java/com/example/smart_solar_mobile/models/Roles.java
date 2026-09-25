// File: Roles.java
// Purpose: Role names exactly as the API sends them in the login response.
// Author: IT23215856

package com.example.smart_solar_mobile.models;

public final class Roles {
    public static final String PROSUMER = "Prosumer";
    public static final String GRID_OPERATOR = "GridOperator";
    public static final String BACKOFFICE = "Backoffice";

    private Roles() {
        // Constants only, never instantiated
    }
}

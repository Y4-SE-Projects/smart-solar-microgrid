// File: NameUtils.java
// Purpose: Shared helpers for showing a person's name, used by both the Prosumer and Grid Operator home screens.
// Author: IT23218512

package com.example.smart_solar_mobile.utils;

public final class NameUtils {

    private NameUtils() {
        // Static helper only, never instantiated
    }

    public static String initialsOf(String name) {
        // Up to two initials from a name for the avatar circle, e.g. "Kamal Perera" -> "KP"
        if (name == null) {
            return "";
        }
        StringBuilder initials = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            if (!part.isEmpty() && initials.length() < 2) {
                initials.append(Character.toUpperCase(part.charAt(0)));
            }
        }
        return initials.toString();
    }
}

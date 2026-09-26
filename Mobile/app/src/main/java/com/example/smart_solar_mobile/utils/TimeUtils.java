// File: TimeUtils.java
// Purpose: Reads the API's UTC timestamps and formats them in the phone's local time (java.time needs API 26, minSdk is 24).
// Author: IT23215856

package com.example.smart_solar_mobile.utils;

import android.content.Context;

import com.example.smart_solar_mobile.R;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public final class TimeUtils {

    private TimeUtils() {
        // Static helper only, never instantiated
    }

    public static Date parseApiDate(String value) {
        // Parses e.g. "2026-09-26T02:30:00Z"; returns null when the value is missing or unreadable
        if (value == null || value.isEmpty()) {
            return null;
        }
        // .NET can send up to 7 fraction digits, which SimpleDateFormat would misread, so they are dropped
        String text = value.replaceFirst("\\.\\d+", "");
        if (!text.matches(".*(Z|[+-]\\d{2}:\\d{2})$")) {
            text = text + "Z";
        }
        try {
            return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(text);
        } catch (ParseException e) {
            return null;
        }
    }

    public static String formatTime(Date date) {
        // Local 24-hour time, e.g. "08:00"
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(date);
    }

    public static String formatShortDate(Date date) {
        // Local date for headings, e.g. "Sat, 26 Sep"
        return new SimpleDateFormat("EEE, d MMM", Locale.getDefault()).format(date);
    }

    public static String monthKey(Date date) {
        // Local month in the "yyyy-MM" form the slots endpoint's month filter expects
        return new SimpleDateFormat("yyyy-MM", Locale.US).format(date);
    }

    public static boolean isSameLocalDay(Date a, Date b) {
        // True when both instants fall on the same calendar day in the phone's time zone
        Calendar first = Calendar.getInstance();
        first.setTime(a);
        Calendar second = Calendar.getInstance();
        second.setTime(b);
        return first.get(Calendar.YEAR) == second.get(Calendar.YEAR)
                && first.get(Calendar.DAY_OF_YEAR) == second.get(Calendar.DAY_OF_YEAR);
    }

    public static String formatDuration(Context context, long minutes) {
        // Short length of a slot, e.g. "45 min", "2 h", "1 h 30 min"
        long hours = minutes / 60;
        long rest = minutes % 60;
        if (hours == 0) {
            return context.getString(R.string.duration_minutes, (int) rest);
        }
        if (rest == 0) {
            return context.getString(R.string.duration_hours, (int) hours);
        }
        return context.getString(R.string.duration_hours_minutes, (int) hours, (int) rest);
    }
}

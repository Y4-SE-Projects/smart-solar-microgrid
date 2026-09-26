// File: MonthCalendarView.java
// Purpose: Month calendar (weeks start on Monday, like the web app) that highlights the selected day, today and marked days.
// Author: IT23215856

package com.example.smart_solar_mobile.views;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.utils.TimeUtils;

import java.util.Calendar;
import java.util.Date;
import java.util.Set;

public class MonthCalendarView extends LinearLayout {

    // Receives day taps and the month arrows; the screen owns the state and calls render() again
    public interface Listener {
        void onDaySelected(Date day);

        void onMonthChanged(int monthDelta);
    }

    private static final int WEEKS = 6;
    private static final int DAYS_PER_WEEK = 7;
    private static final Typeface MEDIUM = Typeface.create("sans-serif-medium", Typeface.NORMAL);

    private final TextView monthTitle;
    private final LinearLayout[] weekRows = new LinearLayout[WEEKS];
    private final TextView[] dayTexts = new TextView[WEEKS * DAYS_PER_WEEK];
    private final View[] todayDots = new View[WEEKS * DAYS_PER_WEEK];
    private Listener listener;

    public MonthCalendarView(Context context, @Nullable AttributeSet attrs) {
        // Builds the header, the weekday labels and a 6 x 7 grid of day cells once; render() only restyles them
        super(context, attrs);
        setOrientation(VERTICAL);
        LayoutInflater inflater = LayoutInflater.from(context);
        inflater.inflate(R.layout.view_month_calendar, this, true);

        monthTitle = findViewById(R.id.calendarMonthTitle);
        findViewById(R.id.calendarPrevButton).setOnClickListener(v -> {
            if (listener != null) {
                listener.onMonthChanged(-1);
            }
        });
        findViewById(R.id.calendarNextButton).setOnClickListener(v -> {
            if (listener != null) {
                listener.onMonthChanged(1);
            }
        });
        addWeekdayLabels(findViewById(R.id.calendarWeekdays));

        LinearLayout grid = findViewById(R.id.calendarGrid);
        for (int week = 0; week < WEEKS; week++) {
            LinearLayout row = new LinearLayout(context);
            row.setOrientation(HORIZONTAL);
            for (int day = 0; day < DAYS_PER_WEEK; day++) {
                View cell = inflater.inflate(R.layout.item_calendar_day, row, false);
                row.addView(cell);
                dayTexts[week * DAYS_PER_WEEK + day] = cell.findViewById(R.id.dayText);
                todayDots[week * DAYS_PER_WEEK + day] = cell.findViewById(R.id.dayTodayDot);
            }
            grid.addView(row, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
            weekRows[week] = row;
        }
    }

    public void setListener(Listener listener) {
        // Sets who handles day taps and month changes
        this.listener = listener;
    }

    public void render(Date month, Date selectedDay, Set<String> markedDayKeys, boolean markedAreMatches) {
        // Draws the month containing `month`; markedDayKeys are TimeUtils.dayKey values of days to highlight
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(TimeUtils.startOfMonth(month));
        monthTitle.setText(TimeUtils.formatMonthYear(calendar.getTime()));

        int leadingBlanks = (calendar.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
        int daysInMonth = calendar.getActualMaximum(Calendar.DAY_OF_MONTH);
        Date today = new Date();

        for (int i = 0; i < dayTexts.length; i++) {
            TextView dayText = dayTexts[i];
            View todayDot = todayDots[i];
            int dayOfMonth = i - leadingBlanks + 1;
            if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
                // Days of the neighbouring months are left blank, like the web calendar
                dayText.setVisibility(INVISIBLE);
                dayText.setOnClickListener(null);
                todayDot.setVisibility(GONE);
                continue;
            }

            calendar.set(Calendar.DAY_OF_MONTH, dayOfMonth);
            Date day = calendar.getTime();
            boolean selected = TimeUtils.isSameLocalDay(day, selectedDay);
            boolean marked = markedDayKeys.contains(TimeUtils.dayKey(day));
            boolean isToday = TimeUtils.isSameLocalDay(day, today);

            // One ordered choice of look, as on the web: selected, then marked, then today, then plain
            int backgroundRes;
            int colorRes;
            if (selected) {
                backgroundRes = R.drawable.bg_day_selected;
                colorRes = R.color.on_primary;
            } else if (marked) {
                backgroundRes = R.drawable.bg_day_marked;
                colorRes = R.color.primary;
            } else if (isToday) {
                backgroundRes = 0;
                colorRes = R.color.secondary;
            } else {
                backgroundRes = 0;
                colorRes = R.color.on_surface;
            }
            int color = ContextCompat.getColor(getContext(), colorRes);

            dayText.setVisibility(VISIBLE);
            dayText.setText(String.valueOf(dayOfMonth));
            dayText.setBackgroundResource(backgroundRes);
            dayText.setTextColor(color);
            dayText.setTypeface(selected || marked || isToday ? MEDIUM : Typeface.DEFAULT);
            dayText.setSelected(selected);
            todayDot.setVisibility(isToday ? VISIBLE : GONE);
            todayDot.setBackgroundTintList(ColorStateList.valueOf(color));

            String description = TimeUtils.formatLongDate(day);
            if (marked) {
                description = getContext().getString(markedAreMatches ? R.string.day_has_matches : R.string.day_has_slots, description);
            }
            dayText.setContentDescription(description);
            dayText.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onDaySelected(day);
                }
            });
        }

        // Hides week rows the month doesn't reach, so short months don't leave an empty row
        for (int week = 0; week < WEEKS; week++) {
            weekRows[week].setVisibility(week * DAYS_PER_WEEK < leadingBlanks + daysInMonth ? VISIBLE : GONE);
        }
    }

    private void addWeekdayLabels(LinearLayout container) {
        // Adds "Mon" to "Sun" above the grid in the phone's language
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY);
        for (int i = 0; i < DAYS_PER_WEEK; i++) {
            TextView label = new TextView(getContext());
            label.setLayoutParams(new LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f));
            label.setGravity(Gravity.CENTER);
            label.setText(TimeUtils.formatWeekdayShort(calendar.getTime()));
            label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            label.setTextColor(ContextCompat.getColor(getContext(), R.color.on_surface_variant));
            label.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
            container.addView(label);
            calendar.add(Calendar.DAY_OF_MONTH, 1);
        }
    }
}

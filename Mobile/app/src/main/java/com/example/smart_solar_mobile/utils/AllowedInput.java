// File: AllowedInput.java
// Purpose: The characters each account field accepts, as InputFilters, so a character the rules forbid can't be typed or pasted in at all.
//          They only remove characters; whether the value is complete ( long enough, the right prefix ) is AccountRules' job.
// Author: IT23218512

package com.example.smart_solar_mobile.utils;

import android.text.InputFilter;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.widget.EditText;

public final class AllowedInput {
    // Marks a typed character as dropped in a filter's decisions
    private static final char DROP = 0;

    private AllowedInput() {
        // Static helper only, never instantiated
    }

    // Digits, then V or X ( shown in capitals ) only straight after the 9th digit, at the end
    public static final InputFilter NIC = (source, start, end, dest, dstart, dend) -> {
        String before = dest.subSequence(0, dstart).toString();
        String after = dest.subSequence(dend, dest.length()).toString();
        StringBuilder kept = new StringBuilder(before);
        char[] decisions = new char[end - start];
        for (int i = start; i < end; i++) {
            char c = source.charAt(i);
            char decision = DROP;
            // Once the box has its letter, the NIC is complete in the old format and takes nothing more
            boolean hasLetter = containsLetter(kept) || containsLetter(after);
            if (c >= '0' && c <= '9' && !hasLetter) {
                decision = c;
            } else if ("VvXx".indexOf(c) >= 0 && !hasLetter && after.isEmpty()
                    && kept.length() == AccountRules.NIC_DIGITS_BEFORE_LETTER) {
                decision = Character.toUpperCase(c);
            }
            decisions[i - start] = decision;
            if (decision != DROP) {
                kept.append(decision);
            }
        }
        return apply(source, start, end, decisions);
    };

    // Letters and single spaces between words; no space at the start of the box
    public static final InputFilter FULL_NAME = (source, start, end, dest, dstart, dend) -> {
        // The start of the box counts as a space, so a leading space is dropped like a double one
        char previous = dstart > 0 ? dest.charAt(dstart - 1) : ' ';
        char next = dend < dest.length() ? dest.charAt(dend) : 0;
        char[] decisions = new char[end - start];
        int lastKept = -1;
        for (int i = start; i < end; i++) {
            char c = source.charAt(i);
            boolean letter = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
            boolean keep = letter || (c == ' ' && previous != ' ');
            decisions[i - start] = keep ? c : DROP;
            if (keep) {
                previous = c;
                lastKept = i - start;
            }
        }
        // A space typed just before an existing space would also make a double space
        if (lastKept >= 0 && decisions[lastKept] == ' ' && next == ' ') {
            decisions[lastKept] = DROP;
        }
        return apply(source, start, end, decisions);
    };

    // Digits, with "+" allowed only as the first character. 
    // Stops at the longest valid number for the format being typed, so pasting "+94 77 123 4567" gives "+94771234567".
    public static final InputFilter PHONE = (source, start, end, dest, dstart, dend) -> {
        String before = dest.subSequence(0, dstart).toString();
        String after = dest.subSequence(dend, dest.length()).toString();
        StringBuilder kept = new StringBuilder(before);
        char[] decisions = new char[end - start];
        for (int i = start; i < end; i++) {
            char c = source.charAt(i);
            char decision = DROP;
            // Nothing may go in front of a "+" that is already first
            boolean frontOfPlus = kept.length() == 0 && after.startsWith("+");
            if (!frontOfPlus) {
                if (c == '+' && kept.length() == 0) {
                    decision = c;
                } else if (c >= '0' && c <= '9') {
                    int limit = kept.toString().startsWith("+")
                            ? AccountRules.INTERNATIONAL_PHONE_LENGTH : AccountRules.LOCAL_PHONE_LENGTH;
                    if (kept.length() + after.length() < limit) {
                        decision = c;
                    }
                }
            }
            decisions[i - start] = decision;
            if (decision != DROP) {
                kept.append(decision);
            }
        }
        return apply(source, start, end, decisions);
    };

    // Email addresses and passwords: anything except spaces
    public static final InputFilter NO_SPACES = (source, start, end, dest, dstart, dend) -> {
        char[] decisions = new char[end - start];
        for (int i = start; i < end; i++) {
            char c = source.charAt(i);
            decisions[i - start] = Character.isWhitespace(c) ? DROP : c;
        }
        return apply(source, start, end, decisions);
    };

    public static void restrict(EditText input, InputFilter filter) {
        // Adds the filter in front of the box's own filters ( such as android:maxLength ). 
        // Therefore, a pasted value is cleaned before it is cut to length.
        // setFilters on its own would replace them.
        InputFilter[] existing = input.getFilters();
        InputFilter[] filters = new InputFilter[existing.length + 1];
        filters[0] = filter;
        System.arraycopy(existing, 0, filters, 1, existing.length);
        input.setFilters(filters);
    }

    private static CharSequence apply(CharSequence source, int start, int end, char[] decisions) {
        // Returns null ( keep as typed ) when nothing changed, otherwise the typed text with the decisions applied.
        // Edits a copy of the source, so the keyboard's spans ( such as the word being composed ) survive and the keyboard doesn't repeat text.
        boolean changed = false;
        for (int i = 0; i < decisions.length; i++) {
            if (decisions[i] != source.charAt(start + i)) {
                changed = true;
                break;
            }
        }
        if (!changed) {
            return null;
        }
        if (source instanceof Spanned) {
            SpannableStringBuilder result = new SpannableStringBuilder(source, start, end);
            for (int i = decisions.length - 1; i >= 0; i--) {
                if (decisions[i] == DROP) {
                    result.delete(i, i + 1);
                } else if (decisions[i] != result.charAt(i)) {
                    result.replace(i, i + 1, String.valueOf(decisions[i]));
                }
            }
            return result;
        }
        StringBuilder result = new StringBuilder();
        for (char decision : decisions) {
            if (decision != DROP) {
                result.append(decision);
            }
        }
        return result.toString();
    }

    private static boolean containsLetter(CharSequence text) {
        // True when the NIC text already has its V or X
        for (int i = 0; i < text.length(); i++) {
            if ("VvXx".indexOf(text.charAt(i)) >= 0) {
                return true;
            }
        }
        return false;
    }
}

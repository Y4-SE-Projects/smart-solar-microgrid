// File: LiveValidation.java
// Purpose: Shows one form field's message under its box, the same way as the web forms: once the user has left the field
//          ( or pressed submit ), and from then on live as they type, disappearing as soon as the value is valid.
// Author: IT23218512

package com.example.smart_solar_mobile.utils;

import android.text.Editable;
import android.text.TextWatcher;
import android.widget.EditText;

import androidx.annotation.Nullable;

import com.google.android.material.textfield.TextInputLayout;

public final class LiveValidation {

    public interface Rule {
        // Returns the message for the value, or null when it is valid
        @Nullable
        String check(String value);
    }

    public interface Listener {
        // Called whenever the field's shown message is updated; null means no message
        void onShown(@Nullable String error);
    }

    private final TextInputLayout layout;
    private final EditText input;
    private final Rule rule;
    @Nullable
    private Listener listener;
    // True once the user has left the field or pressed submit; until then nothing is shown
    private boolean touched;

    public LiveValidation(TextInputLayout layout, Rule rule) {
        // Starts watching the field inside the layout
        this.layout = layout;
        this.input = layout.getEditText();
        this.rule = rule;

        // Keeps the message in step with the value once it is showing
        afterEachChange(input, this::refresh);
        // A global listener rather than setOnFocusChangeListener, which Material's end icons ( clear text ) use themselves and would be replaced
        input.getViewTreeObserver().addOnGlobalFocusChangeListener((oldFocus, newFocus) -> {
            if (oldFocus == input && input.isEnabled()) {
                touched = true;
                show();
            }
        });
    }

    public LiveValidation setListener(@Nullable Listener listener) {
        // Lets a screen follow the shown message, e.g. to turn the password checklist red
        this.listener = listener;
        return this;
    }

    public LiveValidation alsoFollow(EditText other) {
        // Re-checks this field when another one changes, for a rule that reads it ( confirm password follows the password )
        afterEachChange(other, this::refresh);
        return this;
    }

    private void refresh() {
        // Re-checks the field if its message is already in play
        if (touched) {
            show();
        }
    }

    public boolean validate() {
        // On submit: shows the message even if the field was never visited, and reports whether the value is valid
        touched = true;
        return show() == null;
    }

    public static boolean validateAll(LiveValidation... fields) {
        // Checks every field so all messages appear at once, then moves to the first field that needs fixing
        LiveValidation firstInvalid = null;
        for (LiveValidation field : fields) {
            if (!field.validate() && firstInvalid == null) {
                firstInvalid = field;
            }
        }
        if (firstInvalid != null) {
            firstInvalid.input.requestFocus();
        }
        return firstInvalid == null;
    }

    @Nullable
    private String show() {
        // Puts the current message under the box ( or clears it ) and returns it
        Editable text = input.getText();
        String error = rule.check(text == null ? "" : text.toString());
        // Only touches the layout when the message changes, so it doesn't flicker or re-announce on every keystroke
        CharSequence current = layout.getError();
        if (error == null ? current != null : !error.contentEquals(current == null ? "" : current)) {
            layout.setError(error);
        }
        if (listener != null) {
            listener.onShown(error);
        }
        return error;
    }

    public static void afterEachChange(EditText input, Runnable action) {
        // Runs the action after every change to the box's text, typed, pasted or set in code
        input.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
                // Not needed; only the text after a change matters
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                // Not needed; only the text after a change matters
            }

            @Override
            public void afterTextChanged(Editable s) {
                action.run();
            }
        });
    }
}

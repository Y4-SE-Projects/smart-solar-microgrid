// File: ApiErrorParser.java
// Purpose: Turns a failed API response into a message that can be shown to the user.
// Author: IT23215856

package com.example.smart_solar_mobile.network;

import android.content.Context;

import com.example.smart_solar_mobile.R;
import com.google.gson.Gson;
import com.google.gson.JsonParseException;

import java.io.IOException;

import okhttp3.ResponseBody;
import retrofit2.Response;

public final class ApiErrorParser {
    private static final Gson gson = new Gson();

    private ApiErrorParser() {
        // Static helper only, never instantiated
    }

    public static String getMessage(Context context, Response<?> response) {
        // Uses the API's own "message" when the error body has one
        try (ResponseBody errorBody = response.errorBody()) {
            if (errorBody != null) {
                String json = errorBody.string();
                if (!json.isEmpty()) {
                    ApiResponse<?> parsed = gson.fromJson(json, ApiResponse.class);
                    if (parsed != null && parsed.message != null && !parsed.message.isEmpty()) {
                        return parsed.message;
                    }
                }
            }
        } catch (IOException | JsonParseException ignored) {
            // Falls through to a message based on the status code
        }

        // Some errors (e.g. a 401/403 from the token check) arrive with an empty body
        switch (response.code()) {
            case 401:
                return context.getString(R.string.error_unauthorized);
            case 403:
                return context.getString(R.string.error_forbidden);
            case 404:
                return context.getString(R.string.error_not_found);
            default:
                return context.getString(R.string.error_generic, response.code());
        }
    }
}

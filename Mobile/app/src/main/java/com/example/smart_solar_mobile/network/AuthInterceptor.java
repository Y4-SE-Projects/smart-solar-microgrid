// File: AuthInterceptor.java
// Purpose: Adds the saved login token to every API request and handles an expired session.
// Author: IT23215856

package com.example.smart_solar_mobile.network;

import androidx.annotation.NonNull;

import com.example.smart_solar_mobile.SmartSolarApp;
import com.example.smart_solar_mobile.activities.Navigator;
import com.example.smart_solar_mobile.db.SessionManager;

import java.io.IOException;

import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

public class AuthInterceptor implements Interceptor {

    @NonNull
    @Override
    public Response intercept(@NonNull Chain chain) throws IOException {
        // Attaches "Authorization: Bearer <token>" when someone is signed in
        String token = SessionManager.getInstance().getTokenBlocking();
        Request request = chain.request();
        if (token != null) {
            request = request.newBuilder()
                    .header("Authorization", "Bearer " + token)
                    .build();
        }

        Response response = chain.proceed(request);

        // A 401 on a request that carried a token means it expired, so sign out and return to login
        if (response.code() == 401 && token != null && SessionManager.getInstance().clearNow()) {
            Navigator.openLogin(SmartSolarApp.get(), true);
        }
        return response;
    }
}

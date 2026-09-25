package com.example.smart_solar_mobile.network;

import com.example.smart_solar_mobile.BuildConfig;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class NetworkManager {
    private static NetworkManager singleton;
    private final Retrofit retrofit;

    private NetworkManager() {
        OkHttpClient client = new OkHttpClient.Builder()
                .addInterceptor(chain -> {
                    Request request = chain.request().newBuilder()
                            .addHeader("X-Client-Type", "Mobile")
                            .build();
                    return chain.proceed(request);
                })
                .addInterceptor(new AuthInterceptor())
                .build();

        retrofit = new Retrofit.Builder()
                .baseUrl(BuildConfig.API_BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();
    }

    public static NetworkManager getInstance() {
        if (singleton == null) {
            singleton = new NetworkManager();
        }
        return singleton;
    }

    public ApiService getApiService() {
        return retrofit.create(ApiService.class);
    }
}
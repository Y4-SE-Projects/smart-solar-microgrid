package com.example.smart_solar_mobile.network;

import retrofit2.Call;
import retrofit2.http.GET;

public interface ApiService {
    @GET("health/mongo")
    Call<HealthResponse> checkMongoConnection();
}

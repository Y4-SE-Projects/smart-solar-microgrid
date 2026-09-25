package com.example.smart_solar_mobile.network;

import com.example.smart_solar_mobile.models.AuthResponseData;
import com.example.smart_solar_mobile.models.LoginRequest;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;

public interface ApiService {
    @GET("health/mongo")
    Call<HealthResponse> checkMongoConnection();

    @POST("users/login")
    Call<ApiResponse<AuthResponseData>> login(@Body LoginRequest request);
}

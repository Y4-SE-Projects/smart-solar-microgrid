package com.example.smart_solar_mobile.network;

import com.example.smart_solar_mobile.models.AuthResponseData;
import com.example.smart_solar_mobile.models.EnergyBookingSlot;
import com.example.smart_solar_mobile.models.LoginRequest;
import com.example.smart_solar_mobile.models.SolarStation;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {
    @GET("health/mongo")
    Call<HealthResponse> checkMongoConnection();

    @POST("users/login")
    Call<ApiResponse<AuthResponseData>> login(@Body LoginRequest request);

    // Every station, active and deactivated, sorted by stationId
    @GET("stations")
    Call<ApiResponse<List<SolarStation>>> getStations();

    // month is "yyyy-MM"; the API pads it by a day on each side, so filter to local dates after loading
    @GET("stations/{stationId}/slots")
    Call<ApiResponse<List<EnergyBookingSlot>>> getStationSlots(@Path("stationId") String stationId,
                                                               @Query("month") String month);
}

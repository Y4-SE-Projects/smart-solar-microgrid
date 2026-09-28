package com.example.smart_solar_mobile.network;

import com.example.smart_solar_mobile.models.AuthResponseData;
import com.example.smart_solar_mobile.models.CreateReservationRequest;
import com.example.smart_solar_mobile.models.DashboardCounts;
import com.example.smart_solar_mobile.models.EnergyBookingSlot;
import com.example.smart_solar_mobile.models.LoginRequest;
import com.example.smart_solar_mobile.models.QrResponse;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.SetSlotAvailabilityRequest;
import com.example.smart_solar_mobile.models.SolarStation;
import com.example.smart_solar_mobile.models.UpdateReservationRequest;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {
    @GET("health/mongo")
    Call<HealthResponse> checkMongoConnection();

    @POST("users/login")
    Call<ApiResponse<AuthResponseData>> login(@Body LoginRequest request);

    @POST("reservations")
    Call<ApiResponse<ReservationData>> createReservation(
            @Body CreateReservationRequest request);

    @PUT("reservations/{id}")
    Call<ApiResponse<ReservationData>> updateReservation(
            @Path("id") String reservationId,
            @Body UpdateReservationRequest request);

    @PUT("reservations/{id}/cancel")
    Call<ApiResponse<ReservationData>> cancelReservation(
            @Path("id") String reservationId);

    @GET("reservations/prosumer/{nic}/pending")
    Call<ApiResponse<List<ReservationData>>> getPendingReservations(
            @Path("nic") String nic);

    // Every reservation for this Prosumer, all statuses, newest created first
    @GET("reservations/prosumer/{nic}")
    Call<ApiResponse<List<ReservationData>>> getProsumerReservations(
            @Path("nic") String nic);

    // Owner only, and only once the reservation is Approved
    @GET("reservations/{id}/qr")
    Call<ApiResponse<QrResponse>> getQr(@Path("id") String reservationId);

    // Issues a new nonce and version; the previous QR stops working immediately
    @PUT("reservations/{id}/regenerate-qr")
    Call<ApiResponse<QrResponse>> regenerateQr(@Path("id") String reservationId);

    @GET("reservations/prosumer/{nic}/dashboard-counts")
    Call<DashboardCounts> getDashboardCounts(
            @Path("nic") String nic);

    // Every station, active and deactivated, sorted by stationId
    @GET("stations")
    Call<ApiResponse<List<SolarStation>>> getStations();

    // month is "yyyy-MM"; the API pads it by a day on each side, so filter to local dates after loading
    @GET("stations/{stationId}/slots")
    Call<ApiResponse<List<EnergyBookingSlot>>> getStationSlots(@Path("stationId") String stationId,
                                                               @Query("month") String month);

    // Grid Operator only. Taking a slot offline always works; bringing it back is a 409 while a reservation holds it
    @PUT("slots/{slotId}/availability")
    Call<ApiResponse<EnergyBookingSlot>> setSlotAvailability(@Path("slotId") String slotId,
                                                             @Body SetSlotAvailabilityRequest request);

    // Active stations within radiusKm of the given point, nearest first
    @GET("stations/nearby")
    Call<ApiResponse<List<SolarStation>>> getNearbyStations(@Query("lat") double lat, @Query("lng") double lng,
                                                            @Query("radiusKm") double radiusKm);

    // A station's slots that haven't started yet and fall inside the API's booking window, soonest first
    @GET("stations/{stationId}/slots?upcomingOnly=true")
    Call<ApiResponse<List<EnergyBookingSlot>>> getUpcomingSlots(@Path("stationId") String stationId);
}

// File: PendingReservationsActivity.java
// Purpose: Shows the signed-in Prosumer's live Pending reservations.

package com.example.smart_solar_mobile.activities;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.adapters.PendingReservationAdapter;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.ReservationData;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.google.android.material.button.MaterialButton;

import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class PendingReservationsActivity extends AppCompatActivity {

    private String prosumerNic;
    private Call<ApiResponse<List<ReservationData>>> pendingCall;
    private boolean firstResume = true;

    private PendingReservationAdapter adapter;
    private RecyclerView pendingList;
    private View pendingLoadingCard;
    private View pendingStateScroll;
    private TextView pendingNicText;
    private TextView pendingStateTitle;
    private TextView pendingStateMessage;
    private ImageView pendingStateIcon;
    private MaterialButton refreshButton;
    private MaterialButton retryButton;
    private MaterialButton createButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Builds the booking child screen and loads only the authenticated Prosumer's Pending data.
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pending_reservations);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.pendingRoot));

        pendingList = findViewById(R.id.pendingList);
        pendingLoadingCard = findViewById(R.id.pendingLoadingCard);
        pendingStateScroll = findViewById(R.id.pendingStateScroll);
        pendingNicText = findViewById(R.id.pendingNicText);
        pendingStateTitle = findViewById(R.id.pendingStateTitle);
        pendingStateMessage = findViewById(R.id.pendingStateMessage);
        pendingStateIcon = findViewById(R.id.pendingStateIcon);
        refreshButton = findViewById(R.id.pendingRefreshButton);
        retryButton = findViewById(R.id.pendingRetryButton);
        createButton = findViewById(R.id.pendingCreateButton);

        adapter = new PendingReservationAdapter(
                reservation -> startActivity(EditReservationActivity.intentFor(this, reservation)),
                reservation -> startActivity(CancelReservationActivity.intentFor(this, reservation)));
        pendingList.setLayoutManager(new LinearLayoutManager(this));
        pendingList.setAdapter(adapter);

        findViewById(R.id.pendingBackButton).setOnClickListener(view -> finish());
        refreshButton.setOnClickListener(view -> loadPending());
        retryButton.setOnClickListener(view -> loadPending());
        createButton.setOnClickListener(view ->
                startActivity(new Intent(this, CreateReservationActivity.class)));

        showLoading();
        SessionManager.getInstance().loadSession(session -> {
            if (isFinishing() || isDestroyed()) return;
            if (session == null || !Roles.PROSUMER.equals(session.role)
                    || session.identifier == null || session.identifier.trim().isEmpty()) {
                Navigator.openLogin(this, false);
                return;
            }
            prosumerNic = session.identifier.trim();
            pendingNicText.setText(getString(R.string.pending_owner_nic, prosumerNic));
            pendingNicText.setVisibility(View.VISIBLE);
            loadPending();
        });
    }

    @Override
    protected void onResume() {
        // Reloads after a child booking flow returns; the first load waits for the session.
        super.onResume();
        if (firstResume) {
            firstResume = false;
        } else if (prosumerNic != null) {
            loadPending();
        }
    }

    @Override
    protected void onDestroy() {
        // Prevents an obsolete response from updating a destroyed screen.
        if (pendingCall != null) pendingCall.cancel();
        super.onDestroy();
    }

    private void loadPending() {
        // Uses the session NIC; the API remains authoritative for ownership and Pending filtering.
        if (prosumerNic == null) return;
        if (pendingCall != null) pendingCall.cancel();
        showLoading();

        pendingCall = NetworkManager.getInstance().getApiService()
                .getPendingReservations(prosumerNic);
        final Call<ApiResponse<List<ReservationData>>> call = pendingCall;
        call.enqueue(new Callback<ApiResponse<List<ReservationData>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                   @NonNull Response<ApiResponse<List<ReservationData>>> response) {
                if (isFinishing() || isDestroyed() || call != pendingCall || call.isCanceled()) {
                    return;
                }
                ApiResponse<List<ReservationData>> body = response.body();
                if (!response.isSuccessful()) {
                    showError(ApiErrorParser.getMessage(PendingReservationsActivity.this, response));
                } else if (body == null || !body.success || body.data == null) {
                    showError(body != null && body.message != null
                            && !body.message.trim().isEmpty()
                            ? body.message : getString(R.string.pending_error_fallback));
                } else {
                    adapter.setReservations(body.data);
                    if (adapter.getItemCount() == 0) {
                        showEmpty();
                    } else {
                        pendingLoadingCard.setVisibility(View.GONE);
                        pendingStateScroll.setVisibility(View.GONE);
                        pendingList.setVisibility(View.VISIBLE);
                        refreshButton.setEnabled(true);
                    }
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<ReservationData>>> request,
                                  @NonNull Throwable error) {
                if (isFinishing() || isDestroyed() || call != pendingCall || call.isCanceled()) {
                    return;
                }
                showError(getString(R.string.error_network));
            }
        });
    }

    private void showLoading() {
        // Keeps the screen shell visible while a GET response is in flight.
        pendingList.setVisibility(View.GONE);
        pendingStateScroll.setVisibility(View.GONE);
        pendingLoadingCard.setVisibility(View.VISIBLE);
        refreshButton.setEnabled(false);
    }

    private void showEmpty() {
        // Explains an empty server result and offers the existing reservation creation flow.
        showState(R.drawable.ic_calendar, R.color.secondary,
                R.string.pending_empty_title, getString(R.string.pending_empty_body), false);
    }

    private void showError(String message) {
        // Retains an inline server or network message with a safe retry action.
        showState(R.drawable.ic_error, R.color.on_error_container,
                R.string.pending_error_title, message, true);
    }

    private void showState(int iconRes, int tintRes, int titleRes, String message,
                           boolean retry) {
        // Renders the same accessible card for empty and error outcomes.
        pendingStateIcon.setImageResource(iconRes);
        pendingStateIcon.setImageTintList(ColorStateList.valueOf(getColor(tintRes)));
        pendingStateTitle.setText(titleRes);
        pendingStateMessage.setText(message);
        retryButton.setVisibility(retry ? View.VISIBLE : View.GONE);
        createButton.setVisibility(retry ? View.GONE : View.VISIBLE);
        pendingLoadingCard.setVisibility(View.GONE);
        pendingList.setVisibility(View.GONE);
        pendingStateScroll.setVisibility(View.VISIBLE);
        refreshButton.setEnabled(true);
    }
}

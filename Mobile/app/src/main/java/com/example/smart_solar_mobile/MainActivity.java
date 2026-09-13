package com.example.smart_solar_mobile;

import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.example.smart_solar_mobile.network.ApiService;
import com.example.smart_solar_mobile.network.HealthResponse;
import com.example.smart_solar_mobile.network.NetworkManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class MainActivity extends AppCompatActivity {

    private TextView statusText;

    @Override
    protected void onCreate(Bundle savedInstancState) {
        super.onCreate(savedInstancState);
        setContentView(R.layout.activity_main);

        Button testButton = findViewById(R.id.testButton);
        statusText = findViewById(R.id.statusText);

        testButton.setOnClickListener(v -> checkConnection());
    }

    private void checkConnection() {
        statusText.setText("Checking...");

        ApiService apiService = NetworkManager.getInstance().getApiService();
        apiService.checkMongoConnection().enqueue(new Callback<HealthResponse>() {
            @Override
            public void onResponse(Call<HealthResponse> call, Response<HealthResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    statusText.setText(response.body().message);
                } else {
                    statusText.setText("API responded with an error.");
                }
            }

            @Override
            public void onFailure(Call<HealthResponse> call, Throwable t) {
                statusText.setText("Connection failed: " + t.getMessage());
            }
        });
    }
}
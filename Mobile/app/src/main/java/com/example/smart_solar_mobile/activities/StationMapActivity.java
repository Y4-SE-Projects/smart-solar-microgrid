// File: StationMapActivity.java
// Purpose: Prosumer station finder: finds the user's location, shows active stations within the chosen radius on a Google map, and opens a station's slots.
// Author: IT23215856

package com.example.smart_solar_mobile.activities;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.example.smart_solar_mobile.BuildConfig;
import com.example.smart_solar_mobile.R;
import com.example.smart_solar_mobile.db.SessionManager;
import com.example.smart_solar_mobile.models.Roles;
import com.example.smart_solar_mobile.models.SolarStation;
import com.example.smart_solar_mobile.network.ApiErrorParser;
import com.example.smart_solar_mobile.network.ApiResponse;
import com.example.smart_solar_mobile.network.NetworkManager;
import com.example.smart_solar_mobile.utils.InsetsHelper;
import com.example.smart_solar_mobile.views.ProsumerBottomNavigation;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.gson.Gson;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class StationMapActivity extends AppCompatActivity {
    private static final String TAG = "StationMap";
    private static final int[] RADIUS_OPTIONS_KM = {1, 5, 10, 25, 50};
    private static final int DEFAULT_RADIUS_KM = 10;
    private static final String STATE_RADIUS_KM = "radius_km";
    private static final String[] LOCATION_PERMISSIONS = {
            Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION};
    // Origin the map page runs under; a Maps key restricted to websites must list it as an allowed referrer
    private static final String MAP_PAGE_ORIGIN = "https://heliogrid.app/";
    private static final DecimalFormat KM_FORMAT = new DecimalFormat("0.0");

    private FusedLocationProviderClient locationClient;
    private CancellationTokenSource locationCancellation;
    private Location userLocation;
    private int radiusKm = DEFAULT_RADIUS_KM;
    // Stations from the last search, kept so a marker tap can be matched back to its station
    private final List<SolarStation> stations = new ArrayList<>();
    private Call<ApiResponse<List<SolarStation>>> nearbyCall;
    // Set once the Maps JavaScript API has loaded inside the WebView
    private boolean mapReady;

    private final ActivityResultLauncher<String[]> permissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(), result -> onPermissionResult());

    private WebView mapWebView;
    private View radiusScroll;
    private View bottomOverlay;
    private ChipGroup radiusChips;
    private View statusProgress;
    private TextView statusText;
    private TextView statusActionButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Sets up the map page and radius filter, checks the session, then asks for the user's location
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_station_map);
        InsetsHelper.applyEdgeToEdge(this, findViewById(R.id.mapRoot));
        ((ProsumerBottomNavigation) findViewById(R.id.prosumerBottomNavigation))
                .setup(this, ProsumerBottomNavigation.Destination.STATIONS);

        mapWebView = findViewById(R.id.mapWebView);
        radiusScroll = findViewById(R.id.radiusScroll);
        radiusChips = findViewById(R.id.radiusChips);
        bottomOverlay = findViewById(R.id.bottomOverlay);
        statusProgress = findViewById(R.id.statusProgress);
        statusText = findViewById(R.id.statusText);
        statusActionButton = findViewById(R.id.statusActionButton);

        if (savedInstanceState != null) {
            radiusKm = savedInstanceState.getInt(STATE_RADIUS_KM, DEFAULT_RADIUS_KM);
        }

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        findViewById(R.id.myLocationButton).setOnClickListener(v -> locateUser());
        buildRadiusChips();
        loadMapPage();

        locationClient = LocationServices.getFusedLocationProviderClient(this);

        // Checks the session here too, because Android can reopen the app straight onto this screen
        SessionManager.getInstance().loadSession(session -> {
            if (session == null || !Roles.PROSUMER.equals(session.role)) {
                Navigator.openLogin(this, false);
                return;
            }
            locateUser();
        });
    }

    @Override
    protected void onResume() {
        // Resumes the map page's timers and animations
        super.onResume();
        mapWebView.onResume();
    }

    @Override
    protected void onPause() {
        // Pauses the map page while the screen isn't visible
        mapWebView.onPause();
        super.onPause();
    }

    @Override
    protected void onRestart() {
        // Coming back from the settings screens: tries again if the location is still missing
        super.onRestart();
        if (userLocation == null && hasLocationPermission()) {
            locateUser();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        // Keeps the chosen radius across rotation
        super.onSaveInstanceState(outState);
        outState.putInt(STATE_RADIUS_KM, radiusKm);
    }

    @Override
    protected void onDestroy() {
        // Stops the location lookup and station request, and frees the WebView
        if (locationCancellation != null) {
            locationCancellation.cancel();
        }
        if (nearbyCall != null) {
            nearbyCall.cancel();
        }
        mapWebView.destroy();
        super.onDestroy();
    }

    // ---- Map page (Google Maps JavaScript API in a WebView) ----

    // The page is our own asset plus Google's Maps script, and links are sent to the browser, so JavaScript is safe here
    @SuppressLint("SetJavaScriptEnabled")
    private void loadMapPage() {
        // Loads assets/station_map.html with the Maps key filled in
        WebSettings settings = mapWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        mapWebView.addJavascriptInterface(new MapBridge(), "Android");
        mapWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Opens links on the map (Google's terms, "report a problem") in the browser instead of replacing the map
                startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                return true;
            }
        });
        mapWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                // Copies the page's console output to Logcat, which helps when the map misbehaves
                Log.d(TAG, message.message() + " (" + message.sourceId() + ":" + message.lineNumber() + ")");
                return true;
            }
        });

        String html = readAsset("station_map.html").replace("__MAPS_API_KEY__", BuildConfig.MAPS_API_KEY);
        mapWebView.loadDataWithBaseURL(MAP_PAGE_ORIGIN, html, "text/html", "UTF-8", null);
    }

    private String readAsset(String name) {
        // Reads a text file from the app's assets
        try (InputStream input = getAssets().open(name)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            Log.e(TAG, "Could not read " + name, e);
            return "";
        }
    }

    // Methods the map page calls through window.Android; they arrive on a background thread
    private class MapBridge {
        @JavascriptInterface
        public void onMapReady() {
            // The Maps script loaded, so anything already found can be drawn
            runOnUiThread(() -> {
                mapReady = true;
                drawSearchArea();
                drawStations();
            });
        }

        @JavascriptInterface
        public void onStationSelected(String stationId) {
            // A marker was tapped
            runOnUiThread(() -> {
                for (SolarStation station : stations) {
                    if (station.stationId.equals(stationId)) {
                        openStation(station);
                        return;
                    }
                }
            });
        }

        @JavascriptInterface
        public void onMapError(String reason) {
            // The Maps script failed to load ("load") or Google rejected the key ("auth")
            runOnUiThread(() -> showStatus(getString("auth".equals(reason) ? R.string.map_error_auth : R.string.map_error_load),
                    false, 0, null));
        }
    }

    private void drawSearchArea() {
        // Draws the radius around the user and frames it, keeping clear of the chips and the status card
        if (!mapReady || userLocation == null) {
            return;
        }
        float density = getResources().getDisplayMetrics().density;
        String script = String.format(Locale.US, "HelioMap.showSearch(%f, %f, %d, %d, %d);",
                userLocation.getLatitude(), userLocation.getLongitude(), radiusKm * 1000,
                Math.round(radiusScroll.getHeight() / density) + 8, Math.round(bottomOverlay.getHeight() / density) + 8);
        mapWebView.evaluateJavascript(script, null);
    }

    private void drawStations() {
        // Sends the current stations to the map page as JSON; Gson escapes every value
        if (!mapReady) {
            return;
        }
        List<MapPin> pins = new ArrayList<>();
        for (SolarStation station : stations) {
            pins.add(new MapPin(station.stationId,
                    getString(R.string.operator_header_station, station.stationId, station.name),
                    station.latitude, station.longitude));
        }
        mapWebView.evaluateJavascript("HelioMap.showStations(" + new Gson().toJson(pins) + ");", null);
    }

    // What the map page needs to draw one station marker
    private static class MapPin {
        final String stationId;
        final String title;
        final double lat;
        final double lng;

        MapPin(String stationId, String title, double lat, double lng) {
            // Holds one marker's values for JSON conversion
            this.stationId = stationId;
            this.title = title;
            this.lat = lat;
            this.lng = lng;
        }
    }

    // ---- Radius filter ----

    private void buildRadiusChips() {
        // Adds one chip per radius option and re-searches when a different one is picked
        LayoutInflater inflater = getLayoutInflater();
        for (int km : RADIUS_OPTIONS_KM) {
            Chip chip = (Chip) inflater.inflate(R.layout.item_radius_chip, radiusChips, false);
            chip.setId(View.generateViewId());
            chip.setText(getString(R.string.radius_km, km));
            chip.setTag(km);
            radiusChips.addView(chip);
            chip.setChecked(km == radiusKm);
        }
        radiusChips.setOnCheckedStateChangeListener((group, checkedIds) -> {
            if (checkedIds.isEmpty()) {
                return;
            }
            Chip chip = group.findViewById(checkedIds.get(0));
            int km = (Integer) chip.getTag();
            if (km != radiusKm) {
                radiusKm = km;
                searchNearby();
            }
        });
    }

    // ---- Location ----

    private boolean hasLocationPermission() {
        // True when either precise or approximate location has been granted
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    // Only called after hasLocationPermission() has returned true
    @SuppressLint("MissingPermission")
    private void locateUser() {
        // Gets a fresh position, falling back to the last known one; asks for permission first if needed
        if (!hasLocationPermission()) {
            permissionLauncher.launch(LOCATION_PERMISSIONS);
            return;
        }
        showStatus(getString(R.string.locating), true, 0, null);
        if (locationCancellation != null) {
            locationCancellation.cancel();
        }
        locationCancellation = new CancellationTokenSource();
        locationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, locationCancellation.getToken())
                .addOnSuccessListener(this, location -> {
                    if (location != null) {
                        onLocation(location);
                    } else {
                        useLastKnownLocation();
                    }
                })
                .addOnFailureListener(this, e -> useLastKnownLocation());
    }

    // Only called from locateUser(), after the permission check
    @SuppressLint("MissingPermission")
    private void useLastKnownLocation() {
        // Uses the phone's last known position when a fresh fix isn't available (e.g. location services are off)
        locationClient.getLastLocation()
                .addOnSuccessListener(this, location -> {
                    if (location != null) {
                        onLocation(location);
                    } else {
                        showLocationUnavailable();
                    }
                })
                .addOnFailureListener(this, e -> showLocationUnavailable());
    }

    private void onLocation(Location location) {
        // Centres the search on the user's position
        userLocation = location;
        searchNearby();
    }

    private void onPermissionResult() {
        // Continues if location was allowed; otherwise explains why it's needed and offers a way to allow it
        if (hasLocationPermission()) {
            locateUser();
            return;
        }
        // Once Android stops showing the permission dialog, the app's settings page is the only way to allow it
        boolean canAskAgain = shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)
                || shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_COARSE_LOCATION);
        if (canAskAgain) {
            showStatus(getString(R.string.location_permission_needed), false, R.string.allow_location,
                    v -> permissionLauncher.launch(LOCATION_PERMISSIONS));
        } else {
            showStatus(getString(R.string.location_permission_needed), false, R.string.open_settings,
                    v -> startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.fromParts("package", getPackageName(), null))));
        }
    }

    private void showLocationUnavailable() {
        // No position at all, usually because location services are turned off
        showStatus(getString(R.string.location_unavailable), false, R.string.location_settings,
                v -> startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)));
    }

    // ---- Stations ----

    private void searchNearby() {
        // Asks the API for active stations within the chosen radius of the user
        if (userLocation == null) {
            return;
        }
        drawSearchArea();
        showStatus(getString(R.string.searching_stations), true, 0, null);

        if (nearbyCall != null) {
            nearbyCall.cancel();
        }
        int requestedRadiusKm = radiusKm;
        Call<ApiResponse<List<SolarStation>>> call = NetworkManager.getInstance().getApiService()
                .getNearbyStations(userLocation.getLatitude(), userLocation.getLongitude(), requestedRadiusKm);
        nearbyCall = call;
        call.enqueue(new Callback<ApiResponse<List<SolarStation>>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<List<SolarStation>>> c,
                                   @NonNull Response<ApiResponse<List<SolarStation>>> response) {
                // Plots the stations, or shows the API's reason for failing
                if (isFinishing() || isDestroyed() || call.isCanceled() || call != nearbyCall) {
                    return;
                }
                ApiResponse<List<SolarStation>> body = response.body();
                if (response.isSuccessful() && body != null && body.data != null) {
                    showStations(body.data, requestedRadiusKm);
                } else {
                    showStatus(ApiErrorParser.getMessage(StationMapActivity.this, response), false,
                            R.string.retry, v -> searchNearby());
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<List<SolarStation>>> c, @NonNull Throwable t) {
                // The request never reached the API
                if (isFinishing() || isDestroyed() || call.isCanceled() || call != nearbyCall) {
                    return;
                }
                showStatus(getString(R.string.error_network), false, R.string.retry, v -> searchNearby());
            }
        });
    }

    private void showStations(List<SolarStation> found, int searchedRadiusKm) {
        // Keeps the stations the API returned, draws them, and says how many there are
        stations.clear();
        stations.addAll(found);
        drawStations();

        String message = found.isEmpty()
                ? getString(R.string.no_stations_within, searchedRadiusKm)
                : getResources().getQuantityString(R.plurals.stations_within, found.size(), found.size(), searchedRadiusKm);
        showStatus(message, false, 0, null);
    }

    private void openStation(SolarStation station) {
        // Opens the station popup with its distance from the user
        new StationDetailsSheet(this, station, distanceLabel(station)).show();
    }

    private String distanceLabel(SolarStation station) {
        // Straight-line distance for display only, e.g. "850 m away" or "1.8 km away"
        if (userLocation == null) {
            return "";
        }
        float[] meters = new float[1];
        Location.distanceBetween(userLocation.getLatitude(), userLocation.getLongitude(),
                station.latitude, station.longitude, meters);
        if (meters[0] < 1000) {
            return getString(R.string.distance_m_away, Math.round(meters[0]));
        }
        return getString(R.string.distance_km_away, KM_FORMAT.format(meters[0] / 1000));
    }

    // ---- Status card ----

    private void showStatus(String message, boolean loading, @StringRes int actionText, View.OnClickListener action) {
        // Updates the card at the bottom of the map: a message, the line loader, and an optional action button
        statusText.setText(message);
        statusProgress.setVisibility(loading ? View.VISIBLE : View.GONE);
        if (actionText != 0 && action != null) {
            statusActionButton.setText(actionText);
            statusActionButton.setOnClickListener(action);
            statusActionButton.setVisibility(View.VISIBLE);
        } else {
            statusActionButton.setVisibility(View.GONE);
        }
    }
}

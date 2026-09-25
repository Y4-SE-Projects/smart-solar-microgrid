// File: SessionManager.java
// Purpose: Starts, reads and ends the signed-in session, keeping SQLite and memory in step.
// Author: IT23215856

package com.example.smart_solar_mobile.db;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SessionManager {

    // Receives the session on the main thread after it has been read from SQLite
    public interface SessionCallback {
        void onResult(SessionEntity session);
    }

    private static SessionManager instance;

    private final SessionDao sessionDao;
    // Room refuses to run on the main thread, so database work happens here
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // The active session; with "remember me" off it only lives here, not in SQLite
    private SessionEntity currentSession;
    private boolean loaded;

    private SessionManager(Context context) {
        // Connects to the session table
        sessionDao = AppDatabase.getInstance(context).sessionDao();
    }

    public static void init(Context context) {
        // Called once from SmartSolarApp before any screen opens
        if (instance == null) {
            instance = new SessionManager(context.getApplicationContext());
        }
    }

    public static SessionManager getInstance() {
        // Returns the shared session manager
        return instance;
    }

    public void loadSession(SessionCallback callback) {
        // Reads the session off the main thread and hands it back on the main thread
        executor.execute(() -> {
            SessionEntity session = readSession();
            mainHandler.post(() -> callback.onResult(session));
        });
    }

    public void startSession(SessionEntity session, boolean remember, Runnable onDone) {
        // Saves the session after login; only keeps it in SQLite when "remember me" is ticked
        executor.execute(() -> {
            synchronized (this) {
                if (remember) {
                    sessionDao.saveSession(session);
                } else {
                    sessionDao.clearSession();
                }
                currentSession = session;
                loaded = true;
            }
            mainHandler.post(onDone);
        });
    }

    public void endSession(Runnable onDone) {
        // Signs out by removing the session from memory and SQLite
        executor.execute(() -> {
            clearNow();
            mainHandler.post(onDone);
        });
    }

    public String getTokenBlocking() {
        // Returns the token for the network layer; only call off the main thread
        SessionEntity session = readSession();
        return session == null ? null : session.token;
    }

    public synchronized boolean clearNow() {
        // Clears the session straight away and reports whether someone was signed in; only call off the main thread
        boolean wasSignedIn = readSession() != null;
        sessionDao.clearSession();
        currentSession = null;
        loaded = true;
        return wasSignedIn;
    }

    private synchronized SessionEntity readSession() {
        // Uses the copy in memory, reading SQLite only the first time
        if (!loaded) {
            currentSession = sessionDao.getSession();
            loaded = true;
        }
        return currentSession;
    }
}

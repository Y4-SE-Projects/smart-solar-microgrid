// File: ApiResponse.java
// Purpose: The standard { success, message, data } envelope most API endpoints reply with.
// Author: IT23215856

package com.example.smart_solar_mobile.network;

public class ApiResponse<T> {
    public boolean success;
    public String message;
    public T data;
}

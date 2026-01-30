package com.ssdc.ssdclabs.dto;

public class AuthResponse {
    public String token;
    public String labId;
    public String labName;

    public AuthResponse() {}

    public AuthResponse(String token, String labId, String labName) {
        this.token = token;
        this.labId = labId;
        this.labName = labName;
    }
}


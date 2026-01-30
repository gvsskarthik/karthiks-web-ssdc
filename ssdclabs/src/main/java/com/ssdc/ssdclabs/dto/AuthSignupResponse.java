package com.ssdc.ssdclabs.dto;

public class AuthSignupResponse {
    public String message;
    public String labId;

    public AuthSignupResponse() {}

    public AuthSignupResponse(String message, String labId) {
        this.message = message;
        this.labId = labId;
    }
}


package com.ssdc.ssdclabs.dto;

import java.time.OffsetDateTime;

public class AuthResponse {
    public String token;
    public String labId;
    public String labName;
    public Boolean twoFactorRequired;
    public String loginChallenge;
    public OffsetDateTime challengeExpiresAt;

    public AuthResponse() {}

    public AuthResponse(String token, String labId, String labName) {
        this(token, labId, labName, Boolean.FALSE, null, null);
    }

    public AuthResponse(
            String token,
            String labId,
            String labName,
            Boolean twoFactorRequired,
            String loginChallenge,
            OffsetDateTime challengeExpiresAt) {
        this.token = token;
        this.labId = labId;
        this.labName = labName;
        this.twoFactorRequired = twoFactorRequired;
        this.loginChallenge = loginChallenge;
        this.challengeExpiresAt = challengeExpiresAt;
    }

    public static AuthResponse success(String token, String labId, String labName) {
        return new AuthResponse(token, labId, labName, Boolean.FALSE, null, null);
    }

    public static AuthResponse challenge(
            String labId,
            String labName,
            String loginChallenge,
            OffsetDateTime challengeExpiresAt) {
        return new AuthResponse(
            null,
            labId,
            labName,
            Boolean.TRUE,
            loginChallenge,
            challengeExpiresAt
        );
    }
}

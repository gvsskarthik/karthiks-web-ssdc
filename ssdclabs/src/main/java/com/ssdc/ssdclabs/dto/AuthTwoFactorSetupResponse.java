package com.ssdc.ssdclabs.dto;

import java.time.OffsetDateTime;

public class AuthTwoFactorSetupResponse {
    public String manualEntryKey;
    public String otpauthUri;
    public String qrDataUrl;
    public OffsetDateTime setupExpiresAt;

    public AuthTwoFactorSetupResponse() {}

    public AuthTwoFactorSetupResponse(
            String manualEntryKey,
            String otpauthUri,
            String qrDataUrl,
            OffsetDateTime setupExpiresAt) {
        this.manualEntryKey = manualEntryKey;
        this.otpauthUri = otpauthUri;
        this.qrDataUrl = qrDataUrl;
        this.setupExpiresAt = setupExpiresAt;
    }
}

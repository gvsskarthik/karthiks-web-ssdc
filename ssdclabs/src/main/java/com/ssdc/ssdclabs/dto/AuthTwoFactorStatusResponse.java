package com.ssdc.ssdclabs.dto;

import java.time.OffsetDateTime;

public class AuthTwoFactorStatusResponse {
    public Boolean enabled;
    public OffsetDateTime enabledAt;

    public AuthTwoFactorStatusResponse() {}

    public AuthTwoFactorStatusResponse(Boolean enabled, OffsetDateTime enabledAt) {
        this.enabled = enabled;
        this.enabledAt = enabledAt;
    }
}

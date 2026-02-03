package com.ssdc.ssdclabs.dto;

public class AuthChangePasswordRequest {
    public String currentPassword;
    public String newPassword;

    public AuthChangePasswordRequest() {}

    public AuthChangePasswordRequest(String currentPassword, String newPassword) {
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
    }
}

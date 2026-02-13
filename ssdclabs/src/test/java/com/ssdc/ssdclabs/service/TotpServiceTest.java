package com.ssdc.ssdclabs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;

import org.junit.jupiter.api.Test;

class TotpServiceTest {

    @Test
    void generateCode_matchesRfcVectorAt59Seconds() {
        TotpService service = new TotpService("SSDC Labs", 1);
        String secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

        String code = service.generateCode(secret, Instant.ofEpochSecond(59L));

        assertEquals("287082", code);
    }

    @Test
    void verifyCode_allowsOneStepClockSkew() {
        TotpService service = new TotpService("SSDC Labs", 1);
        String secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        String previousStepCode = service.generateCode(secret, Instant.ofEpochSecond(59L));

        assertTrue(service.verifyCode(secret, previousStepCode, Instant.ofEpochSecond(60L)));
    }

    @Test
    void verifyCode_rejectsInvalidFormats() {
        TotpService service = new TotpService("SSDC Labs", 1);
        String secret = service.generateSecret();

        assertFalse(service.verifyCode(secret, "12345", Instant.now()));
        assertFalse(service.verifyCode(secret, "ABCDEF", Instant.now()));
    }

    @Test
    void decodeBase32_rejectsInvalidValue() {
        TotpService service = new TotpService("SSDC Labs", 1);

        assertThrows(IllegalArgumentException.class, () -> service.decodeBase32("not-valid!"));
    }

    @Test
    void buildOtpAuthUri_containsIssuerAccountAndSecret() {
        TotpService service = new TotpService("SSDC Labs", 1);
        String secret = "JBSWY3DPEHPK3PXP";

        String uri = service.buildOtpAuthUri("lab01", secret);

        assertTrue(uri.startsWith("otpauth://totp/SSDC%20Labs:lab01?"));
        assertTrue(uri.contains("secret=" + secret));
        assertTrue(uri.contains("issuer=SSDC%20Labs"));
        assertTrue(uri.contains("digits=6"));
        assertTrue(uri.contains("period=30"));
    }
}

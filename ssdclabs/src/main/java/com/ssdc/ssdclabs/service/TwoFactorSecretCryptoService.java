package com.ssdc.ssdclabs.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TwoFactorSecretCryptoService {

    private static final String CIPHER_ALGORITHM = "AES/GCM/NoPadding";
    private static final int IV_SIZE_BYTES = 12;
    private static final int TAG_SIZE_BITS = 128;
    private static final String VERSION = "v1";

    private final SecureRandom secureRandom = new SecureRandom();
    private final SecretKeySpec keySpec;

    public TwoFactorSecretCryptoService(
            @Value("${app.totp.encryption-key:}") String encryptionKey,
            @Value("${app.jwt.secret:}") String jwtSecret) {
        String keyMaterial = trimToNull(encryptionKey);
        if (keyMaterial == null) {
            keyMaterial = trimToNull(jwtSecret);
        }
        if (keyMaterial == null) {
            throw new IllegalStateException("app.totp.encryption-key or app.jwt.secret must be configured");
        }
        this.keySpec = new SecretKeySpec(sha256(keyMaterial), "AES");
    }

    public String encrypt(String plainText) {
        String value = trimToNull(plainText);
        if (value == null) {
            throw new IllegalArgumentException("plainText is required");
        }

        try {
            byte[] iv = new byte[IV_SIZE_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_SIZE_BITS, iv));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

            return VERSION + "."
                + base64UrlEncode(iv) + "."
                + base64UrlEncode(encrypted);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to encrypt secret", ex);
        }
    }

    public String decrypt(String payload) {
        String value = trimToNull(payload);
        if (value == null) {
            throw new IllegalArgumentException("payload is required");
        }

        String[] parts = value.split("\\.", 3);
        if (parts.length != 3 || !VERSION.equals(parts[0])) {
            throw new IllegalArgumentException("Invalid encrypted payload");
        }

        try {
            byte[] iv = base64UrlDecode(parts[1]);
            byte[] encrypted = base64UrlDecode(parts[2]);
            if (iv.length != IV_SIZE_BYTES) {
                throw new IllegalArgumentException("Invalid encrypted payload");
            }

            Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_SIZE_BITS, iv));
            byte[] plainBytes = cipher.doFinal(encrypted);
            return new String(plainBytes, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid encrypted payload", ex);
        }
    }

    private byte[] sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to derive encryption key", ex);
        }
    }

    private String base64UrlEncode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private byte[] base64UrlDecode(String value) {
        try {
            return Base64.getUrlDecoder().decode(value);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid encrypted payload", ex);
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

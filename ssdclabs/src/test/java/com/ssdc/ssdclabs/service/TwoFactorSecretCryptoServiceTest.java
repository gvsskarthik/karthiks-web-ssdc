package com.ssdc.ssdclabs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class TwoFactorSecretCryptoServiceTest {

    @Test
    void encryptDecrypt_roundTrip() {
        TwoFactorSecretCryptoService service =
            new TwoFactorSecretCryptoService("test-key-0123456789abcdef0123456789", "");

        String encrypted = service.encrypt("MY_BASE32_SECRET");
        String decrypted = service.decrypt(encrypted);

        assertEquals("MY_BASE32_SECRET", decrypted);
    }

    @Test
    void encrypt_usesRandomIv() {
        TwoFactorSecretCryptoService service =
            new TwoFactorSecretCryptoService("test-key-0123456789abcdef0123456789", "");

        String encrypted1 = service.encrypt("MY_BASE32_SECRET");
        String encrypted2 = service.encrypt("MY_BASE32_SECRET");

        assertNotEquals(encrypted1, encrypted2);
    }

    @Test
    void decrypt_rejectsInvalidPayload() {
        TwoFactorSecretCryptoService service =
            new TwoFactorSecretCryptoService("test-key-0123456789abcdef0123456789", "");

        assertThrows(IllegalArgumentException.class, () -> service.decrypt("invalid"));
    }
}

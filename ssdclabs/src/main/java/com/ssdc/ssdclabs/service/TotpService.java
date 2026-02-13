package com.ssdc.ssdclabs.service;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TotpService {

    private static final String HMAC_ALGORITHM = "HmacSHA1";
    private static final int PERIOD_SECONDS = 30;
    private static final int CODE_DIGITS = 6;
    private static final int SECRET_BYTES = 20;
    private static final int[] DIGITS_POWER = {
        1,
        10,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000
    };
    private static final char[] BASE32_ALPHABET =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private static final int[] BASE32_LOOKUP = new int[128];

    static {
        for (int i = 0; i < BASE32_LOOKUP.length; i++) {
            BASE32_LOOKUP[i] = -1;
        }
        for (int i = 0; i < BASE32_ALPHABET.length; i++) {
            BASE32_LOOKUP[BASE32_ALPHABET[i]] = i;
        }
    }

    private final SecureRandom secureRandom = new SecureRandom();
    private final String issuer;
    private final int clockSkewSteps;

    public TotpService(
            @Value("${app.totp.issuer:SSDC Labs}") String issuer,
            @Value("${app.totp.clock-skew-steps:1}") int clockSkewSteps) {
        String safeIssuer = trimToNull(issuer);
        this.issuer = safeIssuer == null ? "SSDC Labs" : safeIssuer;
        this.clockSkewSteps = Math.max(0, Math.min(5, clockSkewSteps));
    }

    public String getIssuer() {
        return issuer;
    }

    public int getPeriodSeconds() {
        return PERIOD_SECONDS;
    }

    public int getClockSkewSteps() {
        return clockSkewSteps;
    }

    public String generateSecret() {
        byte[] bytes = new byte[SECRET_BYTES];
        secureRandom.nextBytes(bytes);
        return encodeBase32(bytes);
    }

    public boolean isValidCodeFormat(String code) {
        String value = trimToNull(code);
        if (value == null || value.length() != CODE_DIGITS) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    public String generateCode(String base32Secret) {
        return generateCode(base32Secret, Instant.now());
    }

    public String generateCode(String base32Secret, Instant at) {
        byte[] secret = decodeBase32(base32Secret);
        long counter = Math.floorDiv(resolveInstant(at).getEpochSecond(), PERIOD_SECONDS);
        int code = hotp(secret, counter);
        return formatCode(code);
    }

    public boolean verifyCode(String base32Secret, String code) {
        return verifyCode(base32Secret, code, Instant.now());
    }

    public boolean verifyCode(String base32Secret, String code, Instant at) {
        if (!isValidCodeFormat(code)) {
            return false;
        }
        byte[] secret = decodeBase32(base32Secret);
        long counter = Math.floorDiv(resolveInstant(at).getEpochSecond(), PERIOD_SECONDS);
        int target = Integer.parseInt(code);
        for (int delta = -clockSkewSteps; delta <= clockSkewSteps; delta++) {
            int candidate = hotp(secret, counter + delta);
            if (candidate == target) {
                return true;
            }
        }
        return false;
    }

    public String buildOtpAuthUri(String accountName, String base32Secret) {
        String account = trimToNull(accountName);
        if (account == null) {
            throw new IllegalArgumentException("accountName is required");
        }
        String secret = trimToNull(base32Secret);
        if (secret == null) {
            throw new IllegalArgumentException("base32Secret is required");
        }

        String encodedIssuer = urlEncode(issuer);
        String encodedAccount = urlEncode(account);
        return "otpauth://totp/" + encodedIssuer + ":" + encodedAccount
            + "?secret=" + secret.toUpperCase(Locale.ROOT)
            + "&issuer=" + encodedIssuer
            + "&algorithm=SHA1"
            + "&digits=" + CODE_DIGITS
            + "&period=" + PERIOD_SECONDS;
    }

    public byte[] decodeBase32(String value) {
        String normalized = normalizeBase32(value);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Base32 value is required");
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream((normalized.length() * 5) / 8);
        int buffer = 0;
        int bitsLeft = 0;

        for (int i = 0; i < normalized.length(); i++) {
            char ch = normalized.charAt(i);
            if (ch >= BASE32_LOOKUP.length || BASE32_LOOKUP[ch] < 0) {
                throw new IllegalArgumentException("Invalid Base32 value");
            }
            buffer = (buffer << 5) | BASE32_LOOKUP[ch];
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out.write((buffer >> (bitsLeft - 8)) & 0xFF);
                bitsLeft -= 8;
            }
        }

        return out.toByteArray();
    }

    public String encodeBase32(byte[] value) {
        Objects.requireNonNull(value, "value");
        if (value.length == 0) {
            throw new IllegalArgumentException("value must not be empty");
        }

        StringBuilder out = new StringBuilder((value.length * 8 + 4) / 5);
        int buffer = 0;
        int bitsLeft = 0;

        for (byte b : value) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                out.append(BASE32_ALPHABET[(buffer >> (bitsLeft - 5)) & 31]);
                bitsLeft -= 5;
            }
        }

        if (bitsLeft > 0) {
            out.append(BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31]);
        }

        return out.toString();
    }

    private int hotp(byte[] secret, long counter) {
        try {
            byte[] counterBytes = ByteBuffer.allocate(8).putLong(counter).array();
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            byte[] hash = mac.doFinal(counterBytes);

            int offset = hash[hash.length - 1] & 0x0F;
            int binary =
                ((hash[offset] & 0x7F) << 24)
                    | ((hash[offset + 1] & 0xFF) << 16)
                    | ((hash[offset + 2] & 0xFF) << 8)
                    | (hash[offset + 3] & 0xFF);
            return binary % DIGITS_POWER[CODE_DIGITS];
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to generate TOTP code", ex);
        }
    }

    private String formatCode(int code) {
        return String.format(Locale.ROOT, "%0" + CODE_DIGITS + "d", code);
    }

    private Instant resolveInstant(Instant at) {
        return at == null ? Instant.now() : at;
    }

    private String normalizeBase32(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch == '=' || Character.isWhitespace(ch)) {
                continue;
            }
            sb.append(Character.toUpperCase(ch));
        }
        return sb.toString();
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

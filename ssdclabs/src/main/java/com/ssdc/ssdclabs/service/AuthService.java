package com.ssdc.ssdclabs.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.config.JwtService;
import com.ssdc.ssdclabs.dto.AuthLoginRequest;
import com.ssdc.ssdclabs.dto.AuthResponse;
import com.ssdc.ssdclabs.dto.AuthSignupRequest;
import com.ssdc.ssdclabs.dto.AuthSignupResponse;
import com.ssdc.ssdclabs.dto.AuthTwoFactorSetupResponse;
import com.ssdc.ssdclabs.dto.AuthTwoFactorStatusResponse;
import com.ssdc.ssdclabs.dto.AuthVerifyTwoFactorLoginRequest;
import com.ssdc.ssdclabs.model.Lab;
import com.ssdc.ssdclabs.repository.LabRepository;
import org.springframework.beans.factory.annotation.Value;

@Service
public class AuthService {

    private static final Pattern LAB_ID_PATTERN =
        Pattern.compile("^[a-z0-9_]{3,6}$");

    private final LabRepository labRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final MailService mailService;
    private final TotpService totpService;
    private final TwoFactorSecretCryptoService twoFactorSecretCryptoService;
    private final String frontendBaseUrl;
    private final long setupTtlSeconds;
    private final long challengeTtlSeconds;
    private final int maxAttempts;

    public AuthService(
            LabRepository labRepo,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            MailService mailService,
            TotpService totpService,
            TwoFactorSecretCryptoService twoFactorSecretCryptoService,
            @Value("${app.totp.setup-ttl-seconds:600}") long setupTtlSeconds,
            @Value("${app.totp.challenge-ttl-seconds:300}") long challengeTtlSeconds,
            @Value("${app.totp.max-attempts:5}") int maxAttempts,
            @Value("${app.frontend.base-url:https://ssdclabs.online}") String frontendBaseUrl) {
        this.labRepo = Objects.requireNonNull(labRepo, "labRepo");
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder, "passwordEncoder");
        this.jwtService = Objects.requireNonNull(jwtService, "jwtService");
        this.mailService = Objects.requireNonNull(mailService, "mailService");
        this.totpService = Objects.requireNonNull(totpService, "totpService");
        this.twoFactorSecretCryptoService =
            Objects.requireNonNull(twoFactorSecretCryptoService, "twoFactorSecretCryptoService");
        this.setupTtlSeconds = Math.max(60L, setupTtlSeconds);
        this.challengeTtlSeconds = Math.max(60L, challengeTtlSeconds);
        this.maxAttempts = Math.max(1, maxAttempts);
        this.frontendBaseUrl = Objects.requireNonNull(frontendBaseUrl, "frontendBaseUrl").replaceAll("/+$", "");
    }

    public AuthSignupResponse signup(AuthSignupRequest request) {
        String labName = trimToNull(request == null ? null : request.labName);
        String labId = normalizeLabId(request == null ? null : request.labId);
        String email = trimToNull(request == null ? null : request.email);
        String phone = trimToNull(request == null ? null : request.phone);
        String password = request == null ? null : request.password;

        if (labName == null) {
            throw new IllegalArgumentException("Lab name is required");
        }
        if (labId == null || !LAB_ID_PATTERN.matcher(labId).matches()) {
            throw new IllegalArgumentException("labId must match ^[a-z0-9_]{3,6}$");
        }
        if (email == null) {
            throw new IllegalArgumentException("Email is required for verification");
        }
        if (password == null || password.trim().length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }
        if (labRepo.existsByLabIdIgnoreCase(labId)) {
            throw new IllegalArgumentException("labId already exists");
        }
        if (!mailService.isEnabled()) {
            throw new IllegalStateException("Email verification not configured");
        }

        Lab lab = new Lab();
        lab.setLabId(labId);
        lab.setLabName(labName);
        lab.setEmail(email);
        lab.setPhone(phone);
        lab.setPasswordHash(passwordEncoder.encode(password));
        lab.setActive(Boolean.FALSE);
        lab.setOnboardingCompleted(Boolean.FALSE);
        lab.setEmailVerified(Boolean.FALSE);

        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        lab.setEmailVerifyTokenHash(sha256Hex(token));
        lab.setEmailVerifyExpiresAt(OffsetDateTime.now().plusMinutes(30));
        lab.setEmailVerifySentAt(OffsetDateTime.now());
        lab.setEmailVerifySendCount(1);
        lab = labRepo.save(lab);

        String verifyLink = buildVerifyLink(lab.getLabId(), token);
        mailService.send(
            email,
            "Verify your SSDC Labs account",
            "Hello " + lab.getLabName() + ",\n\n"
                + "Please verify your email by clicking this link:\n"
                + verifyLink + "\n\n"
                + "This link expires in 30 minutes.\n"
                + "If you did not create this account, ignore this email.\n"
        );

        return new AuthSignupResponse("Verification link sent to email", lab.getLabId());
    }

    public AuthResponse login(AuthLoginRequest request) {
        String labId = normalizeLabId(request == null ? null : request.labId);
        String password = request == null ? null : request.password;
        if (labId == null || password == null) {
            throw new IllegalArgumentException("labId and password are required");
        }

        Lab lab = labRepo.findById(labId).orElse(null);
        if (lab == null) {
            throw new IllegalArgumentException("Invalid labId or password");
        }
        validateLoginGuards(lab);

        if (!passwordEncoder.matches(password, lab.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid labId or password");
        }

        if (!Boolean.TRUE.equals(lab.getTwoFactorEnabled())) {
            String token = jwtService.issueToken(lab.getLabId());
            return AuthResponse.success(token, lab.getLabId(), lab.getLabName());
        }

        String encryptedSecret = trimToNull(lab.getTwoFactorSecretEnc());
        if (encryptedSecret == null) {
            throw new IllegalArgumentException("Invalid labId or password");
        }
        try {
            twoFactorSecretCryptoService.decrypt(encryptedSecret);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid labId or password");
        }

        String challenge = issueTwoFactorLoginChallenge(lab);
        return AuthResponse.challenge(
            lab.getLabId(),
            lab.getLabName(),
            challenge,
            lab.getTwoFactorLoginExpiresAt()
        );
    }

    public AuthResponse verifyTwoFactorLogin(AuthVerifyTwoFactorLoginRequest request) {
        String labId = normalizeLabId(request == null ? null : request.labId);
        String challenge = trimToNull(request == null ? null : request.loginChallenge);
        String code = trimToNull(request == null ? null : request.code);
        if (labId == null || challenge == null || code == null) {
            throw new IllegalArgumentException("labId, loginChallenge and code are required");
        }
        if (!totpService.isValidCodeFormat(code)) {
            throw new IllegalArgumentException("Invalid verification code");
        }

        Lab lab = labRepo.findById(labId).orElse(null);
        if (lab == null) {
            throw new IllegalArgumentException("Invalid or expired login challenge");
        }
        validateLoginGuards(lab);

        String challengeHash = trimToNull(lab.getTwoFactorLoginChallengeHash());
        OffsetDateTime challengeExpiry = lab.getTwoFactorLoginExpiresAt();
        Integer attemptCount = lab.getTwoFactorLoginAttempts();
        int attempts = attemptCount == null ? 0 : Math.max(0, attemptCount);

        if (challengeHash == null
                || isExpired(challengeExpiry)
                || attempts >= maxAttempts
                || !timingSafeEqualsHex(challengeHash, sha256Hex(challenge))) {
            throw new IllegalArgumentException("Invalid or expired login challenge");
        }

        String encryptedSecret = trimToNull(lab.getTwoFactorSecretEnc());
        if (encryptedSecret == null) {
            throw new IllegalStateException("2FA not configured");
        }
        final String secret;
        try {
            secret = twoFactorSecretCryptoService.decrypt(encryptedSecret);
        } catch (Exception ex) {
            throw new IllegalStateException("2FA not configured");
        }

        boolean valid = totpService.verifyCode(secret, code, Instant.now());
        if (!valid) {
            int nextAttempts = attempts + 1;
            if (nextAttempts >= maxAttempts) {
                clearTwoFactorLoginChallenge(lab);
            } else {
                lab.setTwoFactorLoginAttempts(nextAttempts);
            }
            labRepo.save(lab);
            throw new IllegalArgumentException("Invalid verification code");
        }

        clearTwoFactorLoginChallenge(lab);
        labRepo.save(lab);

        String token = jwtService.issueToken(lab.getLabId());
        return AuthResponse.success(token, lab.getLabId(), lab.getLabName());
    }

    public AuthTwoFactorStatusResponse getTwoFactorStatus(String labId) {
        String safeLabId = normalizeLabId(labId);
        if (safeLabId == null) {
            throw new IllegalArgumentException("labId is required");
        }

        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        return new AuthTwoFactorStatusResponse(
            Boolean.TRUE.equals(lab.getTwoFactorEnabled()),
            lab.getTwoFactorEnabledAt()
        );
    }

    public AuthTwoFactorSetupResponse setupTwoFactor(String labId, String currentPassword) {
        String safeLabId = normalizeLabId(labId);
        String current = trimToNull(currentPassword);
        if (safeLabId == null) {
            throw new IllegalArgumentException("labId is required");
        }
        if (current == null) {
            throw new IllegalArgumentException("Current password is required");
        }

        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        if (!Boolean.TRUE.equals(lab.getActive())) {
            throw new IllegalStateException("Account locked");
        }
        if (!passwordEncoder.matches(current, lab.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        if (Boolean.TRUE.equals(lab.getTwoFactorEnabled())) {
            throw new IllegalStateException("2FA already enabled");
        }

        String secret = totpService.generateSecret();
        String encryptedSetupSecret = twoFactorSecretCryptoService.encrypt(secret);
        OffsetDateTime setupExpiry = OffsetDateTime.now().plusSeconds(setupTtlSeconds);

        lab.setTwoFactorSetupSecretEnc(encryptedSetupSecret);
        lab.setTwoFactorSetupExpiresAt(setupExpiry);
        clearTwoFactorLoginChallenge(lab);
        labRepo.save(lab);

        String otpAuthUri = totpService.buildOtpAuthUri(lab.getLabId(), secret);
        return new AuthTwoFactorSetupResponse(secret, otpAuthUri, null, setupExpiry);
    }

    public AuthTwoFactorStatusResponse enableTwoFactor(String labId, String code) {
        String safeLabId = normalizeLabId(labId);
        String otpCode = trimToNull(code);
        if (safeLabId == null) {
            throw new IllegalArgumentException("labId is required");
        }
        if (otpCode == null || !totpService.isValidCodeFormat(otpCode)) {
            throw new IllegalArgumentException("Invalid verification code");
        }

        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        if (Boolean.TRUE.equals(lab.getTwoFactorEnabled())) {
            throw new IllegalStateException("2FA already enabled");
        }

        String setupSecretEnc = trimToNull(lab.getTwoFactorSetupSecretEnc());
        OffsetDateTime setupExpiry = lab.getTwoFactorSetupExpiresAt();
        if (setupSecretEnc == null || isExpired(setupExpiry)) {
            throw new IllegalArgumentException("2FA setup expired. Please setup again");
        }

        final String secret;
        try {
            secret = twoFactorSecretCryptoService.decrypt(setupSecretEnc);
        } catch (Exception ex) {
            throw new IllegalArgumentException("2FA setup expired. Please setup again");
        }

        if (!totpService.verifyCode(secret, otpCode, Instant.now())) {
            throw new IllegalArgumentException("Invalid verification code");
        }

        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorEnabledAt(OffsetDateTime.now());
        lab.setTwoFactorSecretEnc(twoFactorSecretCryptoService.encrypt(secret));
        clearTwoFactorSetup(lab);
        clearTwoFactorLoginChallenge(lab);
        labRepo.save(lab);

        return new AuthTwoFactorStatusResponse(Boolean.TRUE, lab.getTwoFactorEnabledAt());
    }

    public AuthTwoFactorStatusResponse disableTwoFactor(
            String labId,
            String currentPassword,
            String code) {
        String safeLabId = normalizeLabId(labId);
        String current = trimToNull(currentPassword);
        String otpCode = trimToNull(code);
        if (safeLabId == null) {
            throw new IllegalArgumentException("labId is required");
        }
        if (current == null) {
            throw new IllegalArgumentException("Current password is required");
        }
        if (otpCode == null || !totpService.isValidCodeFormat(otpCode)) {
            throw new IllegalArgumentException("Invalid verification code");
        }

        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        if (!Boolean.TRUE.equals(lab.getTwoFactorEnabled())) {
            throw new IllegalStateException("2FA already disabled");
        }
        if (!passwordEncoder.matches(current, lab.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        String encryptedSecret = trimToNull(lab.getTwoFactorSecretEnc());
        if (encryptedSecret == null) {
            throw new IllegalStateException("2FA not configured");
        }
        final String secret;
        try {
            secret = twoFactorSecretCryptoService.decrypt(encryptedSecret);
        } catch (Exception ex) {
            throw new IllegalStateException("2FA not configured");
        }

        if (!totpService.verifyCode(secret, otpCode, Instant.now())) {
            throw new IllegalArgumentException("Invalid verification code");
        }

        lab.setTwoFactorEnabled(Boolean.FALSE);
        lab.setTwoFactorEnabledAt(null);
        lab.setTwoFactorSecretEnc(null);
        clearTwoFactorSetup(lab);
        clearTwoFactorLoginChallenge(lab);
        labRepo.save(lab);

        return new AuthTwoFactorStatusResponse(Boolean.FALSE, null);
    }

    public void changePassword(String labId, String currentPassword, String newPassword) {
        String safeLabId = normalizeLabId(labId);
        String current = trimToNull(currentPassword);
        String next = trimToNull(newPassword);
        if (safeLabId == null) {
            throw new IllegalArgumentException("labId is required");
        }
        if (current == null) {
            throw new IllegalArgumentException("Current password is required");
        }
        if (next == null || next.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }

        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        if (!passwordEncoder.matches(current, lab.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        if (passwordEncoder.matches(next, lab.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different");
        }

        lab.setPasswordHash(passwordEncoder.encode(next));
        labRepo.save(lab);
    }

    public void resendVerificationLink(String labId) {
        String safeLabId = normalizeLabId(labId);
        if (safeLabId == null) {
            throw new IllegalArgumentException("labId is required");
        }
        if (!mailService.isEnabled()) {
            throw new IllegalStateException("Email verification not configured");
        }
        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        if (Boolean.TRUE.equals(lab.getEmailVerified())) {
            throw new IllegalStateException("Email already verified");
        }
        OffsetDateTime lastSent = lab.getEmailVerifySentAt();
        if (lastSent != null && lastSent.isAfter(OffsetDateTime.now().minusSeconds(60))) {
            throw new IllegalStateException("Please wait before resending");
        }
        Integer count = lab.getEmailVerifySendCount();
        int nextCount = count == null ? 1 : count + 1;
        if (nextCount > 10) {
            throw new IllegalStateException("Too many requests");
        }
        String email = trimToNull(lab.getEmail());
        if (email == null) {
            throw new IllegalStateException("No email configured for this lab");
        }

        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        lab.setEmailVerifyTokenHash(sha256Hex(token));
        lab.setEmailVerifyExpiresAt(OffsetDateTime.now().plusMinutes(30));
        lab.setEmailVerifySentAt(OffsetDateTime.now());
        lab.setEmailVerifySendCount(nextCount);
        labRepo.save(lab);

        String verifyLink = buildVerifyLink(lab.getLabId(), token);
        mailService.send(
            email,
            "Verify your SSDC Labs account",
            "Please verify your email by clicking this link:\n"
                + verifyLink + "\n\n"
                + "This link expires in 30 minutes.\n"
        );
    }

    public boolean verifyEmail(String labId, String token) {
        String safeLabId = normalizeLabId(labId);
        String tokenValue = trimToNull(token);
        if (safeLabId == null || tokenValue == null) {
            return false;
        }
        Lab lab = labRepo.findById(safeLabId).orElse(null);
        if (lab == null) {
            return false;
        }
        if (Boolean.TRUE.equals(lab.getEmailVerified())) {
            return true;
        }
        OffsetDateTime expires = lab.getEmailVerifyExpiresAt();
        if (expires == null || expires.isBefore(OffsetDateTime.now())) {
            return false;
        }
        String hash = lab.getEmailVerifyTokenHash();
        if (hash == null || !hash.equalsIgnoreCase(sha256Hex(tokenValue))) {
            return false;
        }

        lab.setEmailVerified(Boolean.TRUE);
        lab.setActive(Boolean.TRUE);
        lab.setEmailVerifyTokenHash(null);
        lab.setEmailVerifyExpiresAt(null);
        labRepo.save(lab);
        return true;
    }

    public void requestPasswordReset(String labId) {
        String safeLabId = normalizeLabId(labId);
        if (safeLabId == null) {
            throw new IllegalArgumentException("labId is required");
        }
        if (!mailService.isEnabled()) {
            throw new IllegalStateException("Email not configured");
        }

        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        String email = trimToNull(lab.getEmail());
        if (email == null) {
            throw new IllegalStateException("No email configured for this lab");
        }

        OffsetDateTime lastSent = lab.getPasswordResetSentAt();
        if (lastSent != null && lastSent.isAfter(OffsetDateTime.now().minusSeconds(60))) {
            throw new IllegalStateException("Please wait before requesting again");
        }
        Integer count = lab.getPasswordResetSendCount();
        int nextCount = count == null ? 1 : count + 1;
        if (nextCount > 10) {
            throw new IllegalStateException("Too many requests");
        }

        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        lab.setPasswordResetTokenHash(sha256Hex(token));
        lab.setPasswordResetExpiresAt(OffsetDateTime.now().plusMinutes(30));
        lab.setPasswordResetSentAt(OffsetDateTime.now());
        lab.setPasswordResetSendCount(nextCount);
        labRepo.save(lab);

        String link = buildResetLink(lab.getLabId(), token);
        mailService.send(
            email,
            "Reset your SSDC Labs password",
            "Hello " + lab.getLabName() + ",\n\n"
                + "Click this link to reset your password:\n"
                + link + "\n\n"
                + "This link expires in 30 minutes.\n"
        );
    }

    public boolean resetPassword(String labId, String token, String newPassword) {
        String safeLabId = normalizeLabId(labId);
        String tokenValue = trimToNull(token);
        String password = trimToNull(newPassword);
        if (safeLabId == null || tokenValue == null || password == null) {
            return false;
        }
        if (password.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }

        Lab lab = labRepo.findById(safeLabId).orElse(null);
        if (lab == null) {
            return false;
        }
        OffsetDateTime expires = lab.getPasswordResetExpiresAt();
        if (expires == null || expires.isBefore(OffsetDateTime.now())) {
            return false;
        }
        String hash = lab.getPasswordResetTokenHash();
        if (hash == null || !hash.equalsIgnoreCase(sha256Hex(tokenValue))) {
            return false;
        }

        lab.setPasswordHash(passwordEncoder.encode(password));
        lab.setPasswordResetTokenHash(null);
        lab.setPasswordResetExpiresAt(null);
        labRepo.save(lab);
        return true;
    }

    private void validateLoginGuards(Lab lab) {
        if (!Boolean.TRUE.equals(lab.getEmailVerified())) {
            throw new IllegalStateException("Email not verified");
        }
        if (!Boolean.TRUE.equals(lab.getActive())) {
            throw new IllegalStateException("Account locked");
        }

        LocalDate expiry = lab.getSubscriptionExpiry();
        if (expiry != null) {
            LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
            if (expiry.isBefore(today)) {
                throw new IllegalStateException("Subscription expired");
            }
        }
    }

    private String issueTwoFactorLoginChallenge(Lab lab) {
        String challenge = UUID.randomUUID().toString().replace("-", "")
            + UUID.randomUUID().toString().replace("-", "");
        lab.setTwoFactorLoginChallengeHash(sha256Hex(challenge));
        lab.setTwoFactorLoginExpiresAt(OffsetDateTime.now().plusSeconds(challengeTtlSeconds));
        lab.setTwoFactorLoginAttempts(0);
        labRepo.save(lab);
        return challenge;
    }

    private void clearTwoFactorLoginChallenge(Lab lab) {
        lab.setTwoFactorLoginChallengeHash(null);
        lab.setTwoFactorLoginExpiresAt(null);
        lab.setTwoFactorLoginAttempts(0);
    }

    private void clearTwoFactorSetup(Lab lab) {
        lab.setTwoFactorSetupSecretEnc(null);
        lab.setTwoFactorSetupExpiresAt(null);
    }

    private boolean isExpired(OffsetDateTime expiry) {
        return expiry == null || expiry.isBefore(OffsetDateTime.now());
    }

    private boolean timingSafeEqualsHex(String leftHex, String rightHex) {
        String left = trimToNull(leftHex);
        String right = trimToNull(rightHex);
        if (left == null || right == null) {
            return false;
        }
        return MessageDigest.isEqual(
            left.getBytes(StandardCharsets.UTF_8),
            right.getBytes(StandardCharsets.UTF_8)
        );
    }

    private String buildVerifyLink(String labId, String token) {
        String encodedLab = URLEncoder.encode(labId, StandardCharsets.UTF_8);
        String encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8);
        return frontendBaseUrl + "/api/auth/verify-email?labId=" + encodedLab + "&token=" + encodedToken;
    }

    private String buildResetLink(String labId, String token) {
        String encodedLab = URLEncoder.encode(labId, StandardCharsets.UTF_8);
        String encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8);
        return frontendBaseUrl + "/index.html?reset=1&labId=" + encodedLab + "&token=" + encodedToken;
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash token");
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeLabId(String value) {
        String trimmed = trimToNull(value);
        return trimmed == null ? null : trimmed.toLowerCase();
    }
}

package com.ssdc.ssdclabs.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
    private final String frontendBaseUrl;

    public AuthService(
            LabRepository labRepo,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            MailService mailService,
            @Value("${app.frontend.base-url:https://ssdclabs.online}") String frontendBaseUrl) {
        this.labRepo = Objects.requireNonNull(labRepo, "labRepo");
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder, "passwordEncoder");
        this.jwtService = Objects.requireNonNull(jwtService, "jwtService");
        this.mailService = Objects.requireNonNull(mailService, "mailService");
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

        if (!passwordEncoder.matches(password, lab.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid labId or password");
        }

        String token = jwtService.issueToken(lab.getLabId());
        return new AuthResponse(token, lab.getLabId(), lab.getLabName());
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

    private String buildVerifyLink(String labId, String token) {
        String encodedLab = URLEncoder.encode(labId, StandardCharsets.UTF_8);
        String encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8);
        return frontendBaseUrl + "/api/auth/verify-email?labId=" + encodedLab + "&token=" + encodedToken;
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

package com.ssdc.ssdclabs.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import java.util.regex.Pattern;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.config.JwtService;
import com.ssdc.ssdclabs.dto.AuthLoginRequest;
import com.ssdc.ssdclabs.dto.AuthResponse;
import com.ssdc.ssdclabs.dto.AuthSignupRequest;
import com.ssdc.ssdclabs.model.Lab;
import com.ssdc.ssdclabs.repository.LabRepository;

@Service
public class AuthService {

    private static final Pattern LAB_ID_PATTERN =
        Pattern.compile("^[a-z0-9_]{3,6}$");

    private final LabRepository labRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            LabRepository labRepo,
            PasswordEncoder passwordEncoder,
            JwtService jwtService) {
        this.labRepo = Objects.requireNonNull(labRepo, "labRepo");
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder, "passwordEncoder");
        this.jwtService = Objects.requireNonNull(jwtService, "jwtService");
    }

    public AuthResponse signup(AuthSignupRequest request) {
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
        if (password == null || password.trim().length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }
        if (labRepo.existsByLabIdIgnoreCase(labId)) {
            throw new IllegalArgumentException("labId already exists");
        }

        Lab lab = new Lab();
        lab.setLabId(labId);
        lab.setLabName(labName);
        lab.setEmail(email);
        lab.setPhone(phone);
        lab.setPasswordHash(passwordEncoder.encode(password));
        lab.setActive(Boolean.TRUE);
        lab = labRepo.save(lab);

        String token = jwtService.issueToken(lab.getLabId());
        return new AuthResponse(token, lab.getLabId(), lab.getLabName());
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


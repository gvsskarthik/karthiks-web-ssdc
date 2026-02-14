package com.ssdc.ssdclabs.controller;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.service.PatientService;
import com.ssdc.ssdclabs.service.WhatsAppService;

@RestController
@RequestMapping("/patient-app")
public class PatientAppController {

    private final PatientRepository patientRepo;
    private final PasswordEncoder passwordEncoder;
    private final WhatsAppService whatsAppService;

    public PatientAppController(
            PatientRepository patientRepo,
            PasswordEncoder passwordEncoder,
            WhatsAppService whatsAppService) {
        this.patientRepo = patientRepo;
        this.passwordEncoder = passwordEncoder;
        this.whatsAppService = whatsAppService;
    }

    /**
     * Mobile login: find patient by mobile (appLoginId) and verify password.
     */
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String mobile = body.get("mobile");
        String password = body.get("password");

        if (mobile == null || password == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mobile and password required");
        }

        // Find patient by appLoginId (mobile).
        // Note: multiple visits might exist for same mobile, but we assume
        // appLoginId is unique or we take the latest.
        // For simplicity/MVP: we assume mobile is unique enough or we pick one profile.
        // Actually, Patient entity has unique constraint on appLoginId?
        // Let's check. If not, we might finding multiple patients.
        // For this MVP, let's find the *latest* patient record with this mobile that has a password.
        
        List<Patient> patients = patientRepo.findByMobileOrderByVisitDateDesc(mobile);
        if (patients.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        // Try to match password with any of the patient records (in case they share a login)
        // or just the most recent one.
        Patient matched = null;
        for (Patient p : patients) {
            if (p.getPassword() != null && passwordEncoder.matches(password, p.getPassword())) {
                matched = p;
                break;
            }
        }

        if (matched == null) {
             throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        // Return simple token/profile (for MVP, no full JWT for patient yet, just return ID)
        return Map.of(
            "status", "ok",
            "patientId", matched.getId(),
            "name", matched.getName(),
            "mobile", matched.getMobile()
        );
    }

    /**
     * Get all visits for this mobile number.
     */
    @GetMapping("/visits")
    public List<Patient> getVisits(@RequestParam String mobile) {
        // In a real app, this would be secured by token.
        // For MVP, we trust the mobile sent after login.
        return patientRepo.findByMobileOrderByVisitDateDesc(mobile);
    }

    /**
     * Change Password
     */
    @PostMapping("/change-password")
    public Map<String, String> changePassword(@RequestBody Map<String, String> body) {
        String mobile = body.get("mobile");
        String oldPass = body.get("oldPassword");
        String newPass = body.get("newPassword");

         if (mobile == null || oldPass == null || newPass == null) {
             throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing fields");
         }

         List<Patient> patients = patientRepo.findByMobileOrderByVisitDateDesc(mobile);
         boolean changed = false;
         for (Patient p : patients) {
             if (p.getPassword() != null && passwordEncoder.matches(oldPass, p.getPassword())) {
                 p.setPassword(passwordEncoder.encode(newPass));
                 patientRepo.save(p);
                 changed = true;
             }
         }

         if (!changed) {
             throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid old password");
         }

         return Map.of("status", "ok", "message", "Password changed");
    }
}

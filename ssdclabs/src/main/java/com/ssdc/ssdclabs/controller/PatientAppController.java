package com.ssdc.ssdclabs.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.service.ReportService;

@RestController
@RequestMapping("/patient-app")
public class PatientAppController {

    private final PatientRepository patientRepo;
    private final PasswordEncoder passwordEncoder;
    private final ReportService reportService;

    public PatientAppController(
            PatientRepository patientRepo,
            PasswordEncoder passwordEncoder,
            ReportService reportService) {
        this.patientRepo = patientRepo;
        this.passwordEncoder = passwordEncoder;
        this.reportService = reportService;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String mobile = body.get("mobile");
        String password = body.get("password");

        if (mobile == null || password == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mobile and password required");
        }

        List<Patient> patients = patientRepo.findByMobileOrderByVisitDateDesc(mobile);
        if (patients.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

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

        return Map.of(
            "status", "ok",
            "patientId", matched.getId(),
            "name", matched.getName(),
            "mobile", matched.getMobile()
        );
    }

    @GetMapping("/visits")
    public List<Patient> getVisits(@RequestParam String mobile, @RequestParam String password) {
        if (mobile == null || mobile.trim().isEmpty() || password == null || password.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mobile and password required");
        }
        List<Patient> patients = patientRepo.findByMobileOrderByVisitDateDesc(mobile.trim());
        boolean authenticated = patients.stream().anyMatch(
                p -> p.getPassword() != null && passwordEncoder.matches(password, p.getPassword()));
        if (!authenticated) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return patients;
    }

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

    @PostMapping("/generate-credentials/{patientId}")
    public Map<String, String> generateCredentials(@PathVariable Long patientId) {
        Patient patient = patientRepo.findById(patientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));

        if (patient.getMobile() == null || patient.getMobile().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Patient has no mobile number");
        }

        int randomPin = 100000 + new java.security.SecureRandom().nextInt(900000);
        String clearPassword = String.valueOf(randomPin);
        patient.setPassword(passwordEncoder.encode(clearPassword));
        patientRepo.save(patient);

        return Map.of(
            "mobile", patient.getMobile(),
            "password", clearPassword
        );
    }

    @GetMapping("/report/{patientId}")
    public List<com.ssdc.ssdclabs.dto.PatientAppReportDTO> getReport(
            @PathVariable Long patientId,
            @RequestParam String mobile) {
        if (mobile == null || mobile.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mobile required");
        }

        Patient patient = patientRepo.findById(patientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!mobile.trim().equals(patient.getMobile())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        if (patient.getPassword() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        return reportService.getReportForApp(patient.getLabId(), patientId);
    }
}

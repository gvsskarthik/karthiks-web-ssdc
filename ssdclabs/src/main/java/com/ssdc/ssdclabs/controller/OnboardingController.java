package com.ssdc.ssdclabs.controller;

import java.security.Principal;
import java.util.List;
import java.util.Objects;

import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.OnboardingImportRequest;
import com.ssdc.ssdclabs.dto.OnboardingImportResponse;
import com.ssdc.ssdclabs.dto.OnboardingStatusDTO;
import com.ssdc.ssdclabs.dto.TemplateTestDTO;
import com.ssdc.ssdclabs.service.OnboardingService;

@RestController
@RequestMapping("/onboarding")
public class OnboardingController {

    private final OnboardingService onboardingService;

    public OnboardingController(OnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @GetMapping("/status")
    public OnboardingStatusDTO status(@NonNull Principal principal) {
        return onboardingService.getStatus(Objects.requireNonNull(principal.getName(), "labId"));
    }

    @GetMapping("/template-tests")
    public ResponseEntity<?> templateTests(@NonNull Principal principal) {
        try {
            List<TemplateTestDTO> list = onboardingService.getTemplateTests(principal.getName());
            return ResponseEntity.ok(list);
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(403).body(ex.getMessage());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PostMapping("/import")
    public ResponseEntity<?> importTests(@RequestBody @NonNull OnboardingImportRequest request,
                                         @NonNull Principal principal) {
        try {
            OnboardingImportResponse response =
                onboardingService.importFromTemplate(principal.getName(), request);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(403).body(ex.getMessage());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body("Import failed");
        }
    }

    @PostMapping("/skip")
    public ResponseEntity<?> skip(@NonNull Principal principal) {
        try {
            onboardingService.skip(principal.getName());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }
}


package com.ssdc.ssdclabs.controller;

import java.security.Principal;
import java.util.Objects;

import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.LabNameUpdateRequest;
import com.ssdc.ssdclabs.dto.LabProfileDTO;
import com.ssdc.ssdclabs.service.LabProfileService;

@RestController
@RequestMapping("/lab")
public class LabController {

    private final LabProfileService service;

    public LabController(LabProfileService service) {
        this.service = service;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@NonNull Principal principal) {
        try {
            LabProfileDTO profile = service.getProfile(Objects.requireNonNull(principal.getName(), "labId"));
            return ResponseEntity.ok(profile);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body("Failed to load lab profile");
        }
    }

    @PutMapping("/name")
    public ResponseEntity<?> updateLabName(
            @RequestBody @NonNull LabNameUpdateRequest request,
            @NonNull Principal principal) {
        try {
            LabProfileDTO profile = service.updateLabName(
                Objects.requireNonNull(principal.getName(), "labId"),
                request.labName
            );
            return ResponseEntity.ok(profile);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body("Failed to update lab name");
        }
    }
}


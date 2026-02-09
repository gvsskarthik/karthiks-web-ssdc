package com.ssdc.ssdclabs.controller;

import java.security.Principal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.ssdc.ssdclabs.dto.RecentTaskDTO;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.service.PatientService;

@RestController
@RequestMapping("/patients")
public class PatientController {

    private final PatientService service;

    public PatientController(PatientService service) {
        this.service = service;
    }

    /* ADD PATIENT */
    @PostMapping
    public @NonNull Patient addPatient(@RequestBody @NonNull Patient patient,
                                       @NonNull Principal principal) {
        return service.savePatient(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(patient, "patient")
        );
    }

    /* TODAY */
    @GetMapping("/today")
    public List<Patient> todayPatients(@NonNull Principal principal) {
        return service.findByDate(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(LocalDate.now(ZoneId.of("Asia/Kolkata")), "today"));
    }

    /* BY DATE */
    @GetMapping("/by-date/{date}")
    public List<Patient> byDate(@PathVariable @NonNull String date,
                                @NonNull Principal principal) {
        return service.findByDate(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(LocalDate.parse(date), "date"));
    }

    /* SEARCH (ALL PATIENTS) */
    @GetMapping("/search")
    public List<Patient> searchPatients(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String mobile,
            @NonNull Principal principal) {
        return service.searchPatients(
            Objects.requireNonNull(principal.getName(), "labId"),
            name,
            mobile
        );
    }

    @GetMapping("/tasks/recent")
    public List<RecentTaskDTO> recentTasks(
            @RequestParam(defaultValue = "20") int limit,
            @NonNull Principal principal) {
        if (limit < 1 || limit > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit must be 1..100");
        }
        return service.getRecentTasks(
            Objects.requireNonNull(principal.getName(), "labId"),
            limit
        );
    }

    /* DELETE */
    @DeleteMapping("/{id}")
    public void deletePatient(@PathVariable @NonNull Long id,
                              @NonNull Principal principal) {
        service.deletePatient(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(id, "id")
        );
    }

    @PutMapping("/{id}/status")
    public @NonNull Patient updateStatus(@PathVariable @NonNull Long id,
                                         @RequestBody @NonNull Map<String, String> body,
                                         @NonNull Principal principal) {
        String status = body.get("status");
        if (status == null || status.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
        }
        try {
            return service.updateStatus(
                Objects.requireNonNull(principal.getName(), "labId"),
                Objects.requireNonNull(id, "id"),
                Objects.requireNonNull(status, "status")
            );
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }
}

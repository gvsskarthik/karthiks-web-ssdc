package com.ssdc.ssdclabs.controller;

import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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

    /* BY DATE */
    @GetMapping("/by-date/{date}")
    public List<Patient> byDate(@PathVariable @NonNull String date,
                                @NonNull Principal principal) {
        return service.findByDate(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(LocalDate.parse(date), "date"));
    }

    /* GET BY ID */
    @GetMapping("/{id:\\d+}")
    public @NonNull Patient getPatient(@PathVariable @NonNull Long id,
                                       @NonNull Principal principal) {
        return service.getPatientById(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(id, "id")
        );
    }

    /* SEARCH (ALL PATIENTS) */
    @GetMapping("/search")
    public List<Patient> searchPatients(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String mobile,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int limit,
            @NonNull Principal principal) {
        final String nameQuery = name == null ? "" : name.trim();
        final String mobileQuery = mobile == null ? "" : mobile.trim();
        if (nameQuery.isEmpty() && mobileQuery.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter name or mobile");
        }
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be >= 0");
        }
        if (limit < 1 || limit > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit must be 1..200");
        }
        return service.searchPatientsPaged(
            Objects.requireNonNull(principal.getName(), "labId"),
            nameQuery,
            mobileQuery,
            page,
            limit
        );
    }

    /* UPDATE PATIENT */
    @PutMapping("/{id:\\d+}")
    public @NonNull Patient updatePatient(@PathVariable @NonNull Long id,
                                          @RequestBody @NonNull Patient patient,
                                          @RequestHeader(value = "X-Edit-Pin", required = false) String editPin,
                                          @NonNull Principal principal) {
        try {
            return service.updatePatient(
                Objects.requireNonNull(principal.getName(), "labId"),
                Objects.requireNonNull(id, "id"),
                Objects.requireNonNull(patient, "patient"),
                editPin
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to update patient");
        }
    }

    /* DELETE */
    @DeleteMapping("/{id:\\d+}")
    public void deletePatient(@PathVariable @NonNull Long id,
                              @NonNull Principal principal) {
        service.deletePatient(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(id, "id")
        );
    }

    @PutMapping("/{id:\\d+}/status")
    public @NonNull Patient updateStatus(@PathVariable @NonNull Long id,
                                         @RequestBody @NonNull Map<String, String> body,
                                         @RequestHeader(value = "X-Edit-Pin", required = false) String editPin,
                                         @NonNull Principal principal) {
        String status = body.get("status");
        if (status == null || status.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
        }
        try {
            return service.updateStatus(
                Objects.requireNonNull(principal.getName(), "labId"),
                Objects.requireNonNull(id, "id"),
                Objects.requireNonNull(status, "status"),
                editPin
            );
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }
}

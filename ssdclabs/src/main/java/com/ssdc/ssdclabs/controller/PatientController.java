package com.ssdc.ssdclabs.controller;

import java.security.Principal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

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

    /* DELETE */
    @DeleteMapping("/{id}")
    public void deletePatient(@PathVariable @NonNull Long id,
                              @NonNull Principal principal) {
        service.deletePatient(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(id, "id")
        );
    }
}

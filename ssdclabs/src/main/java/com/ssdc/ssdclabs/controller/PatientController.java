package com.ssdc.ssdclabs.controller;

import java.time.LocalDate;
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
    public @NonNull Patient addPatient(@RequestBody @NonNull Patient patient) {
        return service.savePatient(Objects.requireNonNull(patient, "patient"));
    }

    /* TODAY */
    @GetMapping("/today")
    public List<Patient> todayPatients() {
        return service.findByDate(Objects.requireNonNull(LocalDate.now(), "today"));
    }

    /* BY DATE */
    @GetMapping("/by-date/{date}")
    public List<Patient> byDate(@PathVariable @NonNull String date) {
        return service.findByDate(
            Objects.requireNonNull(LocalDate.parse(date), "date"));
    }

    /* SEARCH (ALL PATIENTS) */
    @GetMapping("/search")
    public List<Patient> searchPatients(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String mobile) {
        return service.searchPatients(name, mobile);
    }

    /* DELETE */
    @DeleteMapping("/{id}")
    public void deletePatient(@PathVariable @NonNull Long id) {
        service.deletePatient(Objects.requireNonNull(id, "id"));
    }
}

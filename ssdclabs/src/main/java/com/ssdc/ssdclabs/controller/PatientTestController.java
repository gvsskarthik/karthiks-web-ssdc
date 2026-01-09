package com.ssdc.ssdclabs.controller;

import java.util.List;

import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.PatientTestResultDTO;
import com.ssdc.ssdclabs.dto.PatientTestSelectionDTO;
import com.ssdc.ssdclabs.service.ReportService;

@RestController
@RequestMapping("/patient-tests")
public class PatientTestController {

    private final ReportService reportService;

    public PatientTestController(ReportService reportService) {
        this.reportService = reportService;
    }

    // SAVE SELECTED TESTS
    @PostMapping("/select")
    public void saveSelectedTests(
            @RequestBody @NonNull List<PatientTestSelectionDTO> tests) {
        reportService.saveSelectedTests(tests);
    }

    // SAVE RESULTS
    @PostMapping("/results")
    public void saveResults(
            @RequestBody @NonNull List<PatientTestResultDTO> results) {
        reportService.saveResults(results);
    }

    // LOAD TESTS FOR PATIENT
    @GetMapping("/{patientId}")
    public List<PatientTestSelectionDTO> getTests(
            @PathVariable @NonNull Long patientId) {
        return reportService.getSelectedTests(patientId);
    }

    // LOAD RESULTS FOR PATIENT
    @GetMapping("/results/{patientId}")
    public List<PatientTestResultDTO> getResults(
            @PathVariable @NonNull Long patientId) {
        return reportService.getResults(patientId);
    }
}

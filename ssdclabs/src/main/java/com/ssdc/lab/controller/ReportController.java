package com.ssdc.lab.controller;

import com.ssdc.lab.domain.patient.PatientTestEntity;
import com.ssdc.lab.domain.result.ResultEntityFactory;
import com.ssdc.lab.domain.result.TestResultEntity;
import com.ssdc.lab.dto.TestResultSaveRequest;
import com.ssdc.lab.service.ReportService;
import com.ssdc.lab.service.VisitService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
  private final ReportService reportService;
  private final VisitService visitService;

  public ReportController(ReportService reportService, VisitService visitService) {
    this.reportService = reportService;
    this.visitService = visitService;
  }

  @GetMapping("/results")
  @Transactional(readOnly = true)
  public Page<TestResultSummary> listResults(Pageable pageable) {
    return reportService.findAllResults(pageable).map(TestResultSummary::fromEntity);
  }

  @GetMapping("/results/{id}")
  @Transactional(readOnly = true)
  public TestResultDetail getResult(@PathVariable Long id) {
    TestResultEntity entity = reportService.findResultById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    return TestResultDetail.fromEntity(entity);
  }

  @GetMapping("/results/by-visit/{visitId}")
  @Transactional(readOnly = true)
  public List<TestResultSummary> listResultsByVisit(@PathVariable Long visitId) {
    List<PatientTestEntity> patientTests = visitService.findPatientTestsByVisitId(visitId);
    List<Long> patientTestIds = patientTests.stream().map(PatientTestEntity::getId).toList();
    return reportService.findResultsByPatientTestIds(patientTestIds).stream()
      .map(TestResultSummary::fromEntity)
      .toList();
  }

  @PostMapping("/results")
  public ResponseEntity<TestResultDetail> createResult(@RequestBody TestResultSaveRequest request) {
    PatientTestEntity patientTest = visitService.findPatientTestById(request.patientTestId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

    TestResultEntity entity = ResultEntityFactory.createTestResult();
    entity.setPatientTest(patientTest);
    ResultMetadata metadata = resolveMetadata(patientTest);
    entity.setParameterName(metadata.parameterName());
    entity.setUnit(metadata.unit());

    TestResultEntity saved = reportService.saveResultValue(entity, request.resultValue());
    return ResponseEntity.status(HttpStatus.CREATED).body(TestResultDetail.fromEntity(saved));
  }

  @PostMapping("/results/bulk")
  public List<TestResultDetail> createResults(@RequestBody List<TestResultSaveRequest> requests) {
    if (requests == null || requests.isEmpty()) {
      return List.of();
    }
    List<TestResultDetail> savedResults = new ArrayList<>();
    for (TestResultSaveRequest request : requests) {
      if (request == null || isBlank(request.resultValue())) {
        continue;
      }
      PatientTestEntity patientTest = visitService.findPatientTestById(request.patientTestId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
      TestResultEntity entity = ResultEntityFactory.createTestResult();
      entity.setPatientTest(patientTest);
      ResultMetadata metadata = resolveMetadata(patientTest);
      entity.setParameterName(metadata.parameterName());
      entity.setUnit(metadata.unit());
      TestResultEntity saved = reportService.saveResultValue(entity, request.resultValue());
      savedResults.add(TestResultDetail.fromEntity(saved));
    }
    return savedResults;
  }

  @PutMapping("/results/{id}")
  public TestResultDetail updateResult(@PathVariable Long id, @RequestBody TestResultSaveRequest request) {
    TestResultEntity entity = reportService.findResultById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

    TestResultEntity saved = reportService.saveResultValue(entity, request.resultValue());
    return TestResultDetail.fromEntity(saved);
  }

  @DeleteMapping("/results/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteResult(@PathVariable Long id) {
    TestResultEntity entity = reportService.findResultById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    reportService.deleteResult(entity);
  }

  private ResultMetadata resolveMetadata(PatientTestEntity patientTest) {
    // Metadata is resolved server-side; default results are display-only and excluded for now.
    // Future parameter/default logic should be added here without touching save flow.
    return new ResultMetadata("Result", "");
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }

  private record ResultMetadata(
    String parameterName,
    String unit
  ) {
  }

  public record TestResultSummary(
    Long id,
    Long patientTestId,
    String parameterName,
    String resultValue,
    String unit
  ) {
    public static TestResultSummary fromEntity(TestResultEntity entity) {
      return new TestResultSummary(
        entity.getId(),
        entity.getPatientTest().getId(),
        entity.getParameterName(),
        entity.getResultValue(),
        entity.getUnit()
      );
    }
  }

  public record TestResultDetail(
    Long id,
    Long patientTestId,
    String parameterName,
    String resultValue,
    String unit
  ) {
    public static TestResultDetail fromEntity(TestResultEntity entity) {
      return new TestResultDetail(
        entity.getId(),
        entity.getPatientTest().getId(),
        entity.getParameterName(),
        entity.getResultValue(),
        entity.getUnit()
      );
    }
  }
}

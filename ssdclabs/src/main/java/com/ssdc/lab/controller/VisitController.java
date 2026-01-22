package com.ssdc.lab.controller;

import com.ssdc.lab.domain.doctor.DoctorEntity;
import com.ssdc.lab.domain.patient.PatientEntity;
import com.ssdc.lab.domain.patient.PatientEntityFactory;
import com.ssdc.lab.domain.patient.PatientTestEntity;
import com.ssdc.lab.domain.patient.PatientVisitEntity;
import com.ssdc.lab.domain.test.TestEntity;
import com.ssdc.lab.service.DoctorService;
import com.ssdc.lab.service.PatientService;
import com.ssdc.lab.service.TestService;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/visits")
public class VisitController {
  private final VisitService visitService;
  private final PatientService patientService;
  private final DoctorService doctorService;
  private final TestService testService;

  public VisitController(VisitService visitService,
                         PatientService patientService,
                         DoctorService doctorService,
                         TestService testService) {
    this.visitService = visitService;
    this.patientService = patientService;
    this.doctorService = doctorService;
    this.testService = testService;
  }

  @GetMapping
  @Transactional(readOnly = true)
  public Page<VisitSummary> listVisits(Pageable pageable) {
    return visitService.findAllVisits(pageable).map(VisitSummary::fromEntity);
  }

  @GetMapping("/{id}")
  @Transactional(readOnly = true)
  public VisitDetail getVisit(@PathVariable Long id) {
    PatientVisitEntity entity = visitService.findVisitById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    return VisitDetail.fromEntity(entity);
  }

  @PostMapping
  public ResponseEntity<VisitDetail> createVisit(@RequestBody VisitRequest request) {
    PatientEntity patient = patientService.findById(request.patientId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

    DoctorEntity doctor = null;
    if (request.doctorId() != null) {
      doctor = doctorService.findById(request.doctorId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    PatientVisitEntity entity = PatientEntityFactory.createVisit();
    entity.setPatient(patient);
    entity.setDoctor(doctor);
    apply(entity, request);

    PatientVisitEntity saved = visitService.saveVisit(entity);
    return ResponseEntity.status(HttpStatus.CREATED).body(VisitDetail.fromEntity(saved));
  }

  @PutMapping("/{id}")
  public VisitDetail updateVisit(@PathVariable Long id, @RequestBody VisitRequest request) {
    PatientVisitEntity entity = visitService.findVisitById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

    PatientEntity patient = patientService.findById(request.patientId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

    DoctorEntity doctor = null;
    if (request.doctorId() != null) {
      doctor = doctorService.findById(request.doctorId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    entity.setPatient(patient);
    entity.setDoctor(doctor);
    apply(entity, request);

    PatientVisitEntity saved = visitService.saveVisit(entity);
    return VisitDetail.fromEntity(saved);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteVisit(@PathVariable Long id) {
    PatientVisitEntity entity = visitService.findVisitById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    visitService.deleteVisit(entity);
  }

  @GetMapping("/patient-tests")
  @Transactional(readOnly = true)
  public Page<PatientTestSummary> listPatientTests(Pageable pageable) {
    return visitService.findAllPatientTests(pageable).map(PatientTestSummary::fromEntity);
  }

  @GetMapping("/patient-tests/{id}")
  @Transactional(readOnly = true)
  public PatientTestDetail getPatientTest(@PathVariable Long id) {
    PatientTestEntity entity = visitService.findPatientTestById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    return PatientTestDetail.fromEntity(entity);
  }

  @PostMapping("/patient-tests")
  public ResponseEntity<PatientTestDetail> createPatientTest(@RequestBody PatientTestRequest request) {
    PatientVisitEntity visit = visitService.findVisitById(request.visitId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    TestEntity test = testService.findTestById(request.testId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

    PatientTestEntity entity = PatientEntityFactory.createPatientTest();
    entity.setVisit(visit);
    entity.setTest(test);
    entity.setPriceAtTime(request.priceAtTime());

    PatientTestEntity saved = visitService.savePatientTest(entity);
    return ResponseEntity.status(HttpStatus.CREATED).body(PatientTestDetail.fromEntity(saved));
  }

  @PutMapping("/patient-tests/{id}")
  public PatientTestDetail updatePatientTest(@PathVariable Long id, @RequestBody PatientTestRequest request) {
    PatientTestEntity entity = visitService.findPatientTestById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    PatientVisitEntity visit = visitService.findVisitById(request.visitId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    TestEntity test = testService.findTestById(request.testId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

    entity.setVisit(visit);
    entity.setTest(test);
    entity.setPriceAtTime(request.priceAtTime());

    PatientTestEntity saved = visitService.savePatientTest(entity);
    return PatientTestDetail.fromEntity(saved);
  }

  @DeleteMapping("/patient-tests/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deletePatientTest(@PathVariable Long id) {
    PatientTestEntity entity = visitService.findPatientTestById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    visitService.deletePatientTest(entity);
  }

  private static void apply(PatientVisitEntity entity, VisitRequest request) {
    entity.setVisitDate(request.visitDate());
    entity.setLabName(request.labName());
    entity.setDiscountAmount(request.discountAmount());
    entity.setPaidAmount(request.paidAmount());
    entity.setStatus(request.status());
  }

  public record VisitRequest(
    Long patientId,
    Long doctorId,
    LocalDateTime visitDate,
    String labName,
    BigDecimal discountAmount,
    BigDecimal paidAmount,
    PatientVisitEntity.Status status
  ) {
  }

  public record VisitSummary(
    Long id,
    Long patientId,
    Long doctorId,
    LocalDateTime visitDate,
    BigDecimal discountAmount,
    BigDecimal paidAmount,
    PatientVisitEntity.Status status
  ) {
    public static VisitSummary fromEntity(PatientVisitEntity entity) {
      Long doctorId = entity.getDoctor() != null ? entity.getDoctor().getId() : null;
      return new VisitSummary(
        entity.getId(),
        entity.getPatient().getId(),
        doctorId,
        entity.getVisitDate(),
        entity.getDiscountAmount(),
        entity.getPaidAmount(),
        entity.getStatus()
      );
    }
  }

  public record VisitDetail(
    Long id,
    Long patientId,
    Long doctorId,
    LocalDateTime visitDate,
    String labName,
    BigDecimal discountAmount,
    BigDecimal paidAmount,
    PatientVisitEntity.Status status
  ) {
    public static VisitDetail fromEntity(PatientVisitEntity entity) {
      Long doctorId = entity.getDoctor() != null ? entity.getDoctor().getId() : null;
      return new VisitDetail(
        entity.getId(),
        entity.getPatient().getId(),
        doctorId,
        entity.getVisitDate(),
        entity.getLabName(),
        entity.getDiscountAmount(),
        entity.getPaidAmount(),
        entity.getStatus()
      );
    }
  }

  public record PatientTestRequest(
    Long visitId,
    Long testId,
    BigDecimal priceAtTime
  ) {
  }

  public record PatientTestSummary(
    Long id,
    Long visitId,
    Long testId,
    BigDecimal priceAtTime
  ) {
    public static PatientTestSummary fromEntity(PatientTestEntity entity) {
      return new PatientTestSummary(
        entity.getId(),
        entity.getVisit().getId(),
        entity.getTest().getId(),
        entity.getPriceAtTime()
      );
    }
  }

  public record PatientTestDetail(
    Long id,
    Long visitId,
    Long testId,
    BigDecimal priceAtTime
  ) {
    public static PatientTestDetail fromEntity(PatientTestEntity entity) {
      return new PatientTestDetail(
        entity.getId(),
        entity.getVisit().getId(),
        entity.getTest().getId(),
        entity.getPriceAtTime()
      );
    }
  }
}

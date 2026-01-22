package com.ssdc.lab.controller;

import com.ssdc.lab.domain.patient.PatientEntity;
import com.ssdc.lab.domain.patient.PatientEntityFactory;
import com.ssdc.lab.service.PatientService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

@RestController
@RequestMapping("/api/patients")
public class PatientController {
  private final PatientService patientService;

  public PatientController(PatientService patientService) {
    this.patientService = patientService;
  }

  @GetMapping
  public Page<PatientSummary> list(Pageable pageable) {
    return patientService.findAll(pageable).map(PatientSummary::fromEntity);
  }

  @GetMapping("/{id}")
  public PatientDetail get(@PathVariable Long id) {
    PatientEntity entity = patientService.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    return PatientDetail.fromEntity(entity);
  }

  @PostMapping
  public ResponseEntity<PatientDetail> create(@RequestBody PatientRequest request) {
    PatientEntity entity = PatientEntityFactory.createPatient();
    apply(entity, request);
    PatientEntity saved = patientService.save(entity);
    return ResponseEntity.status(HttpStatus.CREATED).body(PatientDetail.fromEntity(saved));
  }

  @PutMapping("/{id}")
  public PatientDetail update(@PathVariable Long id, @RequestBody PatientRequest request) {
    PatientEntity entity = patientService.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    apply(entity, request);
    PatientEntity saved = patientService.save(entity);
    return PatientDetail.fromEntity(saved);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id) {
    PatientEntity entity = patientService.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    patientService.delete(entity);
  }

  private static void apply(PatientEntity entity, PatientRequest request) {
    entity.setPatientCode(request.patientCode());
    entity.setName(request.name());
    entity.setAge(request.age());
    entity.setSex(request.sex());
    entity.setMobile(request.mobile());
    entity.setAddress(request.address());
  }

  public record PatientRequest(
    String patientCode,
    String name,
    int age,
    PatientEntity.Sex sex,
    String mobile,
    String address
  ) {
  }

  public record PatientSummary(
    Long id,
    String patientCode,
    String name,
    int age,
    PatientEntity.Sex sex,
    String mobile
  ) {
    public static PatientSummary fromEntity(PatientEntity entity) {
      return new PatientSummary(
        entity.getId(),
        entity.getPatientCode(),
        entity.getName(),
        entity.getAge(),
        entity.getSex(),
        entity.getMobile()
      );
    }
  }

  public record PatientDetail(
    Long id,
    String patientCode,
    String name,
    int age,
    PatientEntity.Sex sex,
    String mobile,
    String address
  ) {
    public static PatientDetail fromEntity(PatientEntity entity) {
      return new PatientDetail(
        entity.getId(),
        entity.getPatientCode(),
        entity.getName(),
        entity.getAge(),
        entity.getSex(),
        entity.getMobile(),
        entity.getAddress()
      );
    }
  }
}

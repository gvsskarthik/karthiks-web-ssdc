package com.ssdc.lab.controller;

import com.ssdc.lab.domain.doctor.DoctorEntity;
import com.ssdc.lab.domain.doctor.DoctorEntityFactory;
import com.ssdc.lab.service.DoctorService;
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

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {
  private final DoctorService doctorService;

  public DoctorController(DoctorService doctorService) {
    this.doctorService = doctorService;
  }

  @GetMapping
  public Page<DoctorSummary> list(Pageable pageable) {
    return doctorService.findAll(pageable).map(DoctorSummary::fromEntity);
  }

  @GetMapping("/{id}")
  public DoctorDetail get(@PathVariable Long id) {
    DoctorEntity entity = doctorService.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    return DoctorDetail.fromEntity(entity);
  }

  @PostMapping
  public ResponseEntity<DoctorDetail> create(@RequestBody DoctorRequest request) {
    DoctorEntity entity = DoctorEntityFactory.createDoctor();
    apply(entity, request);
    DoctorEntity saved = doctorService.save(entity);
    return ResponseEntity.status(HttpStatus.CREATED).body(DoctorDetail.fromEntity(saved));
  }

  @PutMapping("/{id}")
  public DoctorDetail update(@PathVariable Long id, @RequestBody DoctorRequest request) {
    DoctorEntity entity = doctorService.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    apply(entity, request);
    DoctorEntity saved = doctorService.save(entity);
    return DoctorDetail.fromEntity(saved);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id) {
    DoctorEntity entity = doctorService.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    doctorService.delete(entity);
  }

  private static void apply(DoctorEntity entity, DoctorRequest request) {
    entity.setName(request.name());
    entity.setSpecialization(request.specialization());
    entity.setPhone(request.phone());
    entity.setHospital(request.hospital());
    entity.setCommissionPercentage(request.commissionPercentage());
    entity.setDisplayName(request.displayName());
    entity.setActive(request.isActive());
  }

  public record DoctorRequest(
    String name,
    String specialization,
    String phone,
    String hospital,
    BigDecimal commissionPercentage,
    String displayName,
    boolean isActive
  ) {
  }

  public record DoctorSummary(
    Long id,
    String name,
    String specialization,
    String phone,
    boolean isActive
  ) {
    public static DoctorSummary fromEntity(DoctorEntity entity) {
      return new DoctorSummary(
        entity.getId(),
        entity.getName(),
        entity.getSpecialization(),
        entity.getPhone(),
        entity.isActive()
      );
    }
  }

  public record DoctorDetail(
    Long id,
    String name,
    String specialization,
    String phone,
    String hospital,
    BigDecimal commissionPercentage,
    String displayName,
    boolean isActive
  ) {
    public static DoctorDetail fromEntity(DoctorEntity entity) {
      return new DoctorDetail(
        entity.getId(),
        entity.getName(),
        entity.getSpecialization(),
        entity.getPhone(),
        entity.getHospital(),
        entity.getCommissionPercentage(),
        entity.getDisplayName(),
        entity.isActive()
      );
    }
  }
}

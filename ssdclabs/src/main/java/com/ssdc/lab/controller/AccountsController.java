package com.ssdc.lab.controller;

import com.ssdc.lab.domain.doctor.DoctorEntity;
import com.ssdc.lab.domain.patient.PatientEntity;
import com.ssdc.lab.domain.patient.PatientTestEntity;
import com.ssdc.lab.domain.patient.PatientVisitEntity;
import com.ssdc.lab.repository.DoctorRepository;
import com.ssdc.lab.repository.PatientRepository;
import com.ssdc.lab.repository.PatientTestRepository;
import com.ssdc.lab.repository.PatientVisitRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/accounts")
public class AccountsController {
  private final PatientVisitRepository patientVisitRepository;
  private final PatientTestRepository patientTestRepository;
  private final PatientRepository patientRepository;
  private final DoctorRepository doctorRepository;

  public AccountsController(PatientVisitRepository patientVisitRepository,
                            PatientTestRepository patientTestRepository,
                            PatientRepository patientRepository,
                            DoctorRepository doctorRepository) {
    this.patientVisitRepository = patientVisitRepository;
    this.patientTestRepository = patientTestRepository;
    this.patientRepository = patientRepository;
    this.doctorRepository = doctorRepository;
  }

  @GetMapping("/doctors")
  public List<DoctorAccountSummary> listDoctors() {
    return doctorRepository.findAll().stream()
      .sorted(Comparator.comparing(DoctorEntity::getName))
      .map(doctor -> new DoctorAccountSummary(
        doctor.getId(),
        doctor.getName(),
        doctor.getCommissionPercentage()
      ))
      .toList();
  }

  @GetMapping("/details")
  public List<AccountDetail> listAllDetails() {
    return buildDetails(null);
  }

  @GetMapping("/doctor/{doctorId}/details")
  public List<AccountDetail> listDoctorDetails(@PathVariable Long doctorId) {
    return buildDetails(doctorId);
  }

  private List<AccountDetail> buildDetails(Long doctorId) {
    List<PatientVisitEntity> visits = patientVisitRepository.findAll();
    if (doctorId != null) {
      visits = visits.stream()
        .filter(visit -> visit.getDoctor() != null && doctorId.equals(visit.getDoctor().getId()))
        .toList();
    }

    Map<Long, PatientEntity> patientMap = patientRepository.findAll().stream()
      .collect(Collectors.toMap(PatientEntity::getId, patient -> patient));

    Map<Long, DoctorEntity> doctorMap = doctorRepository.findAll().stream()
      .collect(Collectors.toMap(DoctorEntity::getId, doctor -> doctor));

    Map<Long, BigDecimal> totalsByVisit = patientTestRepository.findAll().stream()
      .collect(Collectors.groupingBy(
        test -> test.getVisit().getId(),
        Collectors.mapping(
          PatientTestEntity::getPriceAtTime,
          Collectors.reducing(BigDecimal.ZERO, BigDecimal::add)
        )
      ));

    return visits.stream()
      .sorted(Comparator.comparing(PatientVisitEntity::getVisitDate).reversed())
      .map(visit -> {
        PatientEntity patient = patientMap.get(visit.getPatient().getId());
        DoctorEntity doctor = visit.getDoctor() != null
          ? doctorMap.get(visit.getDoctor().getId())
          : null;

        BigDecimal billAmount = totalsByVisit.getOrDefault(visit.getId(), BigDecimal.ZERO);
        BigDecimal commissionRate = doctor != null && doctor.getCommissionPercentage() != null
          ? doctor.getCommissionPercentage()
          : BigDecimal.ZERO;
        BigDecimal commissionAmount =
          billAmount.multiply(commissionRate).divide(new BigDecimal("100"));

        LocalDate date = visit.getVisitDate() != null
          ? visit.getVisitDate().toLocalDate()
          : null;

        return new AccountDetail(
          date != null ? date.toString() : "",
          visit.getId(),
          patient != null ? patient.getName() : "",
          doctor != null ? doctor.getName() : "SELF",
          billAmount,
          commissionAmount,
          visit.getDiscountAmount()
        );
      })
      .toList();
  }

  public record DoctorAccountSummary(
    Long doctorId,
    String doctorName,
    BigDecimal commissionRate
  ) {
  }

  public record AccountDetail(
    String date,
    Long reportId,
    String patientName,
    String doctorName,
    BigDecimal billAmount,
    BigDecimal commissionAmount,
    BigDecimal discountAmount
  ) {
  }
}

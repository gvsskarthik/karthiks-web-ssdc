package com.ssdc.lab.service;

import com.ssdc.lab.domain.patient.PatientTestEntity;
import com.ssdc.lab.domain.patient.PatientVisitEntity;
import com.ssdc.lab.repository.PatientTestRepository;
import com.ssdc.lab.repository.PatientVisitRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class VisitService {
  private final PatientVisitRepository patientVisitRepository;
  private final PatientTestRepository patientTestRepository;

  public VisitService(PatientVisitRepository patientVisitRepository,
                      PatientTestRepository patientTestRepository) {
    this.patientVisitRepository = patientVisitRepository;
    this.patientTestRepository = patientTestRepository;
  }

  public Page<PatientVisitEntity> findAllVisits(Pageable pageable) {
    return patientVisitRepository.findAll(pageable);
  }

  public Optional<PatientVisitEntity> findVisitById(Long id) {
    return patientVisitRepository.findById(id);
  }

  @Transactional
  public PatientVisitEntity saveVisit(PatientVisitEntity entity) {
    return patientVisitRepository.save(entity);
  }

  @Transactional
  public void deleteVisit(PatientVisitEntity entity) {
    patientVisitRepository.delete(entity);
  }

  public Page<PatientTestEntity> findAllPatientTests(Pageable pageable) {
    return patientTestRepository.findAll(pageable);
  }

  public Optional<PatientTestEntity> findPatientTestById(Long id) {
    return patientTestRepository.findById(id);
  }

  @Transactional
  public PatientTestEntity savePatientTest(PatientTestEntity entity) {
    return patientTestRepository.save(entity);
  }

  @Transactional
  public void deletePatientTest(PatientTestEntity entity) {
    patientTestRepository.delete(entity);
  }
}

package com.ssdc.lab.service;

import com.ssdc.lab.domain.patient.PatientEntity;
import com.ssdc.lab.repository.PatientRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class PatientService {
  private final PatientRepository patientRepository;

  public PatientService(PatientRepository patientRepository) {
    this.patientRepository = patientRepository;
  }

  public Page<PatientEntity> findAll(Pageable pageable) {
    return patientRepository.findAll(pageable);
  }

  public Optional<PatientEntity> findById(Long id) {
    return patientRepository.findById(id);
  }

  @Transactional
  public PatientEntity save(PatientEntity entity) {
    return patientRepository.save(entity);
  }

  @Transactional
  public void delete(PatientEntity entity) {
    patientRepository.delete(entity);
  }
}

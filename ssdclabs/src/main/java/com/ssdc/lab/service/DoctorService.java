package com.ssdc.lab.service;

import com.ssdc.lab.domain.doctor.DoctorEntity;
import com.ssdc.lab.repository.DoctorRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class DoctorService {
  private final DoctorRepository doctorRepository;

  public DoctorService(DoctorRepository doctorRepository) {
    this.doctorRepository = doctorRepository;
  }

  public Page<DoctorEntity> findAll(Pageable pageable) {
    return doctorRepository.findAll(pageable);
  }

  public Optional<DoctorEntity> findById(Long id) {
    return doctorRepository.findById(id);
  }

  @Transactional
  public DoctorEntity save(DoctorEntity entity) {
    return doctorRepository.save(entity);
  }

  @Transactional
  public void delete(DoctorEntity entity) {
    doctorRepository.delete(entity);
  }
}

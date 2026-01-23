package com.ssdc.lab.repository;

import com.ssdc.lab.domain.patient.PatientTestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PatientTestRepository extends JpaRepository<PatientTestEntity, Long> {
  List<PatientTestEntity> findByVisitId(Long visitId);
}

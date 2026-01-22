package com.ssdc.lab.repository;

import com.ssdc.lab.domain.patient.PatientTestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientTestRepository extends JpaRepository<PatientTestEntity, Long> {
}

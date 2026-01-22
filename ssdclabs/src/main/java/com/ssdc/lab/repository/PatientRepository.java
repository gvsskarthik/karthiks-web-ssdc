package com.ssdc.lab.repository;

import com.ssdc.lab.domain.patient.PatientEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientRepository extends JpaRepository<PatientEntity, Long> {
}

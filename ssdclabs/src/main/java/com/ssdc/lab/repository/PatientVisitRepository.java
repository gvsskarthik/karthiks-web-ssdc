package com.ssdc.lab.repository;

import com.ssdc.lab.domain.patient.PatientVisitEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientVisitRepository extends JpaRepository<PatientVisitEntity, Long> {
}

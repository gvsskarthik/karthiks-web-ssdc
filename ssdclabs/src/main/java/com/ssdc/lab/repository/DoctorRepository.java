package com.ssdc.lab.repository;

import com.ssdc.lab.domain.doctor.DoctorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DoctorRepository extends JpaRepository<DoctorEntity, Long> {
}

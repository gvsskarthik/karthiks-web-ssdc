package com.ssdc.ssdclabs.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.Doctor;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {
    // Ordered by name for predictable dropdowns and lists.
    java.util.List<Doctor> findByLabIdOrderByNameAsc(String labId);

    java.util.Optional<Doctor> findFirstByLabIdAndNameIgnoreCase(String labId, String name);

    java.util.Optional<Doctor> findByIdAndLabId(Long id, String labId);
}

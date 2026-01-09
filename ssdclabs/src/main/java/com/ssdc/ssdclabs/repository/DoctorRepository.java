package com.ssdc.ssdclabs.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.Doctor;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {
    // Ordered by name for predictable dropdowns and lists.
    java.util.List<Doctor> findAllByOrderByNameAsc();

    java.util.Optional<Doctor> findFirstByNameIgnoreCase(String name);
}

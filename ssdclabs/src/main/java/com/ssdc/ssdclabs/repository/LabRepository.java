package com.ssdc.ssdclabs.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.Lab;

public interface LabRepository extends JpaRepository<Lab, String> {
    boolean existsByLabIdIgnoreCase(String labId);
}


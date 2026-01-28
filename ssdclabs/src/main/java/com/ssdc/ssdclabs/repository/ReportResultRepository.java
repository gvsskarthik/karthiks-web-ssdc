package com.ssdc.ssdclabs.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.ReportResult;

public interface ReportResultRepository
        extends JpaRepository<ReportResult, Long> {
    List<ReportResult> findByPatient_Id(Long patientId);

    Optional<ReportResult> findFirstByPatient_IdAndTest_IdAndParameter_IdAndSubTest(
        Long patientId,
        Long testId,
        Long parameterId,
        String subTest
    );

    Optional<ReportResult> findFirstByPatient_IdAndTest_IdAndParameter_IdAndSubTestIsNull(
        Long patientId,
        Long testId,
        Long parameterId
    );

    void deleteByPatient_Id(Long patientId);
}

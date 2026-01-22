package com.ssdc.ssdclabs.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("""
        select r from ReportResult r
        where r.patient.id = :patientId
          and r.test.id = :testId
          and r.parameter.id = :parameterId
          and (r.subTest is null or r.subTest = '')
        """)
    Optional<ReportResult> findFirstByPatientTestParamWithEmptySubTest(
        @Param("patientId") Long patientId,
        @Param("testId") Long testId,
        @Param("parameterId") Long parameterId
    );

    void deleteByPatient_Id(Long patientId);
}

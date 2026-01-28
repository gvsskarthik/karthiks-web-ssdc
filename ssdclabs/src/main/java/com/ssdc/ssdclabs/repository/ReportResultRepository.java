package com.ssdc.ssdclabs.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssdc.ssdclabs.model.ReportResult;

public interface ReportResultRepository
        extends JpaRepository<ReportResult, Long> {
    interface PatientTestPair {
        Long getPatientId();
        Long getTestId();
    }

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

    @Query("""
        SELECT DISTINCT rr.patient.id AS patientId, rr.test.id AS testId
        FROM ReportResult rr
        WHERE rr.patient.visitDate BETWEEN :start AND :end
    """)
    List<PatientTestPair> findPatientTestPairsByVisitDateBetween(
        @Param("start") LocalDate start,
        @Param("end") LocalDate end
    );
}

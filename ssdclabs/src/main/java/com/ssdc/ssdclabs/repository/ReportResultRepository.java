package com.ssdc.ssdclabs.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssdc.ssdclabs.model.ReportResult;

public interface ReportResultRepository
        extends JpaRepository<ReportResult, Long> {
    @Query("""
        SELECT r
        FROM ReportResult r
        LEFT JOIN FETCH r.test t
        LEFT JOIN FETCH r.parameter p
        WHERE r.patient.id = :patientId
          AND r.patient.labId = :labId
        ORDER BY r.id ASC
    """)
    List<ReportResult> findByPatient_Id(@Param("labId") String labId,
                                       @Param("patientId") Long patientId);

    @Query("""
        SELECT r
        FROM ReportResult r
        LEFT JOIN FETCH r.test t
        LEFT JOIN FETCH r.parameter p
        WHERE r.patient.id IN :patientIds
          AND r.patient.labId = :labId
        ORDER BY r.id ASC
    """)
    List<ReportResult> findByPatient_IdIn(@Param("labId") String labId,
                                         @Param("patientIds") List<Long> patientIds);

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

package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssdc.ssdclabs.model.Test;

public interface TestRepository extends JpaRepository<Test, Long> {

    boolean existsByLabIdAndShortcutIgnoreCase(String labId, String shortcut);

    java.util.Optional<Test> findByIdAndLabId(Long id, String labId);

    // Ordered by id for stable insertion order.
    List<Test> findByLabIdOrderByIdAsc(String labId);

    // Ordered by id for stable insertion order.
    List<Test> findByLabIdAndActiveTrueOrderByIdAsc(String labId);

    /* ================= SAFE DELETE CHECK ================= */
    @Query("""
        SELECT COUNT(r) > 0
        FROM ReportResult r
        WHERE r.test.id = :testId
          AND r.patient.labId = :labId
    """)
    boolean isTestUsed(@Param("labId") String labId, @Param("testId") Long testId);

 
}

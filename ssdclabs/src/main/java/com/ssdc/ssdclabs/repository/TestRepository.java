package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssdc.ssdclabs.model.Test;

public interface TestRepository extends JpaRepository<Test, Long> {

    boolean existsByShortcut(String shortcut);

    boolean existsByShortcutIgnoreCase(String shortcut);

    @SuppressWarnings("unused")
    List<Test> findByActiveTrue();

    // Ordered by id for stable insertion order.
    List<Test> findAllByOrderByIdAsc();

    // Ordered by id for stable insertion order.
    List<Test> findByActiveTrueOrderByIdAsc();

    /* ================= SAFE DELETE CHECK ================= */
    @Query("""
        SELECT COUNT(r) > 0
        FROM ReportResult r
        WHERE r.test.id = :testId
    """)
    boolean isTestUsed(@Param("testId") Long testId);

 
}

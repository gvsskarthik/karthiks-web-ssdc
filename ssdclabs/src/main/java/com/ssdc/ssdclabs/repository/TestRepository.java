package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

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

    /* ================= DRAG & DROP UPDATE ================= */
    @Modifying
    @Transactional
    @Query("""
        UPDATE Test t
        SET t.displayOrder = :order
        WHERE t.id = :id
    """)
    void updateOrder(@Param("id") Long id,
                     @Param("order") int order);
}

package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.ssdc.ssdclabs.model.Test;
import com.ssdc.ssdclabs.model.TestGroupMapping;

public interface TestRepository extends JpaRepository<Test, Long> {

    boolean existsByShortcut(String shortcut);

    boolean existsByShortcutIgnoreCase(String shortcut);

    @SuppressWarnings("unused")
    List<Test> findByActiveTrue();

    // Ordered by display order, then name for stable fallback.
    List<Test> findAllByOrderByDisplayOrderAscTestNameAsc();

    // Ordered by display order, then name for stable fallback.
    List<Test> findByActiveTrueOrderByDisplayOrderAscTestNameAsc();

    /* ================= SAFE DELETE CHECK ================= */
    @Query("""
        SELECT COUNT(r) > 0
        FROM ReportResult r
        WHERE r.test.id = :testId
    """)
    boolean isTestUsed(@Param("testId") Long testId);

    /* ================= ORDERED GROUP → TEST =================
       Uses display_order (NOT position)
    */
    @Query("""
        SELECT gm
        FROM TestGroupMapping gm
        JOIN FETCH gm.group g
        JOIN FETCH gm.test t
        WHERE t.active = true AND g.active = true
        ORDER BY g.displayOrder ASC, gm.displayOrder ASC, t.displayOrder ASC
    """)
    List<TestGroupMapping> findAllActiveOrdered();

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

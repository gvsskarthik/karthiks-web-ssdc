package com.ssdc.ssdclabs.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssdc.ssdclabs.model.TestGroup;

public interface TestGroupRepository extends JpaRepository<TestGroup, Long> {
    boolean existsByShortcut(String shortcut);

    // Ordered by displayOrder, then groupName for stable fallback.
    java.util.List<TestGroup> findAllByOrderByDisplayOrderAscGroupNameAsc();

    @Modifying
    @Query("UPDATE TestGroup g SET g.displayOrder = :order WHERE g.id = :id")
    void updateOrder(@Param("id") Long id,
                     @Param("order") int order);
}

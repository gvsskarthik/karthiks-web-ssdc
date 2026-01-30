package com.ssdc.ssdclabs.repository;

import org.springframework.data.jpa.repository.JpaRepository;
 

import com.ssdc.ssdclabs.model.TestGroup;

public interface TestGroupRepository extends JpaRepository<TestGroup, Long> {
    boolean existsByLabIdAndShortcutIgnoreCase(String labId, String shortcut);

    // Ordered by displayOrder, then groupName for stable fallback.
    java.util.List<TestGroup> findByLabIdOrderByDisplayOrderAscGroupNameAsc(String labId);

    java.util.Optional<TestGroup> findByIdAndLabId(Long id, String labId);

    java.util.Optional<TestGroup> findFirstByLabIdAndShortcutIgnoreCase(String labId, String shortcut);
 
}

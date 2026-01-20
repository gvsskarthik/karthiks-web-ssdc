package com.ssdc.ssdclabs.repository;

import org.springframework.data.jpa.repository.JpaRepository;
 

import com.ssdc.ssdclabs.model.TestGroup;

public interface TestGroupRepository extends JpaRepository<TestGroup, Long> {
    boolean existsByShortcut(String shortcut);

    // Ordered by displayOrder, then groupName for stable fallback.
    java.util.List<TestGroup> findAllByOrderByDisplayOrderAscGroupNameAsc();

 
}

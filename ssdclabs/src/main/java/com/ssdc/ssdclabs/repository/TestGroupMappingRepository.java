package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.TestGroupMapping;

public interface TestGroupMappingRepository
        extends JpaRepository<TestGroupMapping, Long> {
    List<TestGroupMapping> findByGroup_Id(Long groupId);
    List<TestGroupMapping> findByGroup_IdInOrderByGroup_IdAscDisplayOrderAsc(
        List<Long> groupIds
    );

    boolean existsByGroup_IdAndTest_Id(Long groupId, Long testId);

    void deleteByGroup_Id(Long groupId);
}

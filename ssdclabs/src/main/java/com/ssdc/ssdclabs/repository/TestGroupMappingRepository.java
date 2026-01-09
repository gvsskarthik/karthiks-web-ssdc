package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.TestGroupMapping;

public interface TestGroupMappingRepository
        extends JpaRepository<TestGroupMapping, Long> {
    List<TestGroupMapping> findByGroup_Id(Long groupId);

    void deleteByGroup_Id(Long groupId);
}

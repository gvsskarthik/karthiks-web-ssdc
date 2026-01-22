package com.ssdc.lab.repository;

import com.ssdc.lab.domain.test.TestGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestGroupRepository extends JpaRepository<TestGroupEntity, Long> {
}

package com.ssdc.lab.repository;

import com.ssdc.lab.domain.result.TestResultEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestResultRepository extends JpaRepository<TestResultEntity, Long> {
}

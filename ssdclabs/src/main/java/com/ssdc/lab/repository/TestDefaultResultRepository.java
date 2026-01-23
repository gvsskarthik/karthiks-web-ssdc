package com.ssdc.lab.repository;

import com.ssdc.lab.domain.test.TestDefaultResultEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TestDefaultResultRepository extends JpaRepository<TestDefaultResultEntity, Long> {
  List<TestDefaultResultEntity> findByTestId(Long testId);
  void deleteByTestId(Long testId);
}

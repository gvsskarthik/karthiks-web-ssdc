package com.ssdc.lab.repository;

import com.ssdc.lab.domain.test.TestParameterEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TestParameterRepository extends JpaRepository<TestParameterEntity, Long> {
  List<TestParameterEntity> findByTestId(Long testId);
  void deleteByTestId(Long testId);
}

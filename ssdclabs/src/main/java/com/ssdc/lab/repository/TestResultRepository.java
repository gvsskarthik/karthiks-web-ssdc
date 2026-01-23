package com.ssdc.lab.repository;

import com.ssdc.lab.domain.result.TestResultEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TestResultRepository extends JpaRepository<TestResultEntity, Long> {
  List<TestResultEntity> findByPatientTestIdIn(Collection<Long> patientTestIds);
  List<TestResultEntity> findByPatientTestIdAndParameterName(Long patientTestId, String parameterName);
  void deleteByPatientTestIdAndParameterName(Long patientTestId, String parameterName);
}

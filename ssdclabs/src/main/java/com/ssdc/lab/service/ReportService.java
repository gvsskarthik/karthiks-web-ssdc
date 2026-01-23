package com.ssdc.lab.service;

import com.ssdc.lab.domain.result.TestResultEntity;
import com.ssdc.lab.repository.TestResultRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ReportService {
  private final TestResultRepository testResultRepository;

  public ReportService(TestResultRepository testResultRepository) {
    this.testResultRepository = testResultRepository;
  }

  public Page<TestResultEntity> findAllResults(Pageable pageable) {
    return testResultRepository.findAll(pageable);
  }

  public Optional<TestResultEntity> findResultById(Long id) {
    return testResultRepository.findById(id);
  }

  public List<TestResultEntity> findResultsByPatientTestIds(Collection<Long> patientTestIds) {
    if (patientTestIds == null || patientTestIds.isEmpty()) {
      return List.of();
    }
    return testResultRepository.findByPatientTestIdIn(patientTestIds);
  }

  @Transactional
  public TestResultEntity saveResultValue(TestResultEntity entity, String resultValue) {
    String resolvedValue = resolveResultValue(resultValue);
    String finalValue = selectFinalValue(entity.getResultValue(), resolvedValue);
    entity.setResultValue(finalValue);
    return testResultRepository.save(entity);
  }

  @Transactional
  public void deleteResult(TestResultEntity entity) {
    testResultRepository.delete(entity);
  }

  private String resolveResultValue(String resultValue) {
    // Only resultValue is trusted; checkbox/combine/clear/default/UI branching is intentionally excluded.
    // Future result resolution rules should be added here without changing the save flow.
    return resultValue == null ? "" : resultValue;
  }

  private String selectFinalValue(String existingValue, String resolvedValue) {
    // Never overwrite existing non-blank results with null/blank values.
    if (isBlank(resolvedValue) && !isBlank(existingValue)) {
      return existingValue;
    }
    return resolvedValue;
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}

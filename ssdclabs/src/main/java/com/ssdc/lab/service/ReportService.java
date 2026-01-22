package com.ssdc.lab.service;

import com.ssdc.lab.domain.result.TestResultEntity;
import com.ssdc.lab.repository.TestResultRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

  @Transactional
  public TestResultEntity saveResult(TestResultEntity entity) {
    return testResultRepository.save(entity);
  }

  @Transactional
  public void deleteResult(TestResultEntity entity) {
    testResultRepository.delete(entity);
  }
}

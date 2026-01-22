package com.ssdc.lab.service;

import com.ssdc.lab.domain.test.TestEntity;
import com.ssdc.lab.domain.test.TestGroupEntity;
import com.ssdc.lab.repository.TestGroupRepository;
import com.ssdc.lab.repository.TestRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class TestService {
  private final TestRepository testRepository;
  private final TestGroupRepository testGroupRepository;

  public TestService(TestRepository testRepository, TestGroupRepository testGroupRepository) {
    this.testRepository = testRepository;
    this.testGroupRepository = testGroupRepository;
  }

  public Page<TestEntity> findAllTests(Pageable pageable) {
    return testRepository.findAll(pageable);
  }

  public Optional<TestEntity> findTestById(Long id) {
    return testRepository.findById(id);
  }

  @Transactional
  public TestEntity saveTest(TestEntity entity) {
    return testRepository.save(entity);
  }

  @Transactional
  public void deleteTest(TestEntity entity) {
    testRepository.delete(entity);
  }

  public Page<TestGroupEntity> findAllGroups(Pageable pageable) {
    return testGroupRepository.findAll(pageable);
  }

  public Optional<TestGroupEntity> findGroupById(Long id) {
    return testGroupRepository.findById(id);
  }

  @Transactional
  public TestGroupEntity saveGroup(TestGroupEntity entity) {
    return testGroupRepository.save(entity);
  }

  @Transactional
  public void deleteGroup(TestGroupEntity entity) {
    testGroupRepository.delete(entity);
  }
}

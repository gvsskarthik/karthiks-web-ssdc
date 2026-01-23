package com.ssdc.lab.service;

import com.ssdc.lab.domain.test.GroupTestEntity;
import com.ssdc.lab.domain.test.TestEntity;
import com.ssdc.lab.domain.test.TestEntityFactory;
import com.ssdc.lab.domain.test.TestGroupEntity;
import com.ssdc.lab.repository.GroupTestRepository;
import com.ssdc.lab.repository.TestGroupRepository;
import com.ssdc.lab.repository.TestRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class TestService {
  private final TestRepository testRepository;
  private final TestGroupRepository testGroupRepository;
  private final GroupTestRepository groupTestRepository;

  public TestService(TestRepository testRepository,
                     TestGroupRepository testGroupRepository,
                     GroupTestRepository groupTestRepository) {
    this.testRepository = testRepository;
    this.testGroupRepository = testGroupRepository;
    this.groupTestRepository = groupTestRepository;
  }

  public Page<TestEntity> findAllTests(Pageable pageable) {
    return testRepository.findAll(pageable);
  }

  public Optional<TestEntity> findTestById(Long id) {
    return testRepository.findById(id);
  }

  public List<TestEntity> findTestsByIds(Collection<Long> ids) {
    if (ids == null || ids.isEmpty()) {
      return List.of();
    }
    return testRepository.findAllById(ids);
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

  public Map<Long, List<Long>> findGroupTestIds(Collection<Long> groupIds) {
    if (groupIds == null || groupIds.isEmpty()) {
      return Map.of();
    }
    return groupTestRepository.findByGroupIdIn(groupIds).stream()
      .collect(Collectors.groupingBy(
        groupTest -> groupTest.getGroup().getId(),
        Collectors.mapping(groupTest -> groupTest.getTest().getId(), Collectors.toList())
      ));
  }

  @Transactional
  public void replaceGroupTests(TestGroupEntity group, List<TestEntity> tests) {
    groupTestRepository.deleteByGroupId(group.getId());
    if (tests == null || tests.isEmpty()) {
      return;
    }
    for (TestEntity test : tests) {
      GroupTestEntity mapping = TestEntityFactory.createGroupTest();
      mapping.setGroup(group);
      mapping.setTest(test);
      groupTestRepository.save(mapping);
    }
  }
}

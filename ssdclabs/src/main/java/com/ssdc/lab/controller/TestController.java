package com.ssdc.lab.controller;

import com.ssdc.lab.domain.test.TestEntity;
import com.ssdc.lab.domain.test.TestEntityFactory;
import com.ssdc.lab.domain.test.TestGroupEntity;
import com.ssdc.lab.service.TestService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tests")
public class TestController {
  private final TestService testService;

  public TestController(TestService testService) {
    this.testService = testService;
  }

  @GetMapping
  public Page<TestSummary> listTests(Pageable pageable) {
    return testService.findAllTests(pageable).map(TestSummary::fromEntity);
  }

  @GetMapping("/{id}")
  public TestDetail getTest(@PathVariable Long id) {
    TestEntity entity = testService.findTestById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    return TestDetail.fromEntity(entity);
  }

  @PostMapping
  public ResponseEntity<TestDetail> createTest(@RequestBody TestRequest request) {
    TestRequest normalized = normalize(request);
    validate(normalized);
    if (testService.existsByShortcutIgnoreCase(normalized.shortcut())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Shortcut already exists.");
    }
    TestEntity entity = TestEntityFactory.createTest();
    apply(entity, normalized);
    TestEntity saved = testService.saveTest(entity);
    return ResponseEntity.status(HttpStatus.CREATED).body(TestDetail.fromEntity(saved));
  }

  @PutMapping("/{id}")
  public TestDetail updateTest(@PathVariable Long id, @RequestBody TestRequest request) {
    TestEntity entity = testService.findTestById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    TestRequest normalized = normalize(request);
    validate(normalized);
    if (testService.existsByShortcutIgnoreCaseAndIdNot(normalized.shortcut(), entity.getId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Shortcut already exists.");
    }
    apply(entity, normalized);
    TestEntity saved = testService.saveTest(entity);
    return TestDetail.fromEntity(saved);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteTest(@PathVariable Long id) {
    TestEntity entity = testService.findTestById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    testService.deleteTest(entity);
  }

  @GetMapping("/groups")
  public Page<TestGroupSummary> listGroups(Pageable pageable) {
    Page<TestGroupEntity> page = testService.findAllGroups(pageable);
    List<Long> groupIds = page.getContent().stream()
      .map(TestGroupEntity::getId)
      .toList();
    Map<Long, List<Long>> groupTestIds = testService.findGroupTestIds(groupIds);
    return page.map(entity ->
      TestGroupSummary.fromEntity(entity, groupTestIds.getOrDefault(entity.getId(), List.of()))
    );
  }

  @GetMapping("/groups/{id}")
  public TestGroupDetail getGroup(@PathVariable Long id) {
    TestGroupEntity entity = testService.findGroupById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    Map<Long, List<Long>> groupTestIds = testService.findGroupTestIds(List.of(entity.getId()));
    List<Long> testIds = groupTestIds.getOrDefault(entity.getId(), List.of());
    return TestGroupDetail.fromEntity(entity, testIds);
  }

  @PostMapping("/groups")
  public ResponseEntity<TestGroupDetail> createGroup(@RequestBody TestGroupRequest request) {
    TestGroupEntity entity = TestEntityFactory.createTestGroup();
    apply(entity, request);
    TestGroupEntity saved = testService.saveGroup(entity);
    List<Long> testIds = request.testIds();
    if (testIds != null && !testIds.isEmpty()) {
      testService.replaceGroupTests(saved, testService.findTestsByIds(testIds));
    }
    return ResponseEntity.status(HttpStatus.CREATED)
      .body(TestGroupDetail.fromEntity(saved, testIds == null ? List.of() : testIds));
  }

  @PutMapping("/groups/{id}")
  public TestGroupDetail updateGroup(@PathVariable Long id, @RequestBody TestGroupRequest request) {
    TestGroupEntity entity = testService.findGroupById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    apply(entity, request);
    TestGroupEntity saved = testService.saveGroup(entity);
    List<Long> testIds = request.testIds();
    if (testIds != null) {
      testService.replaceGroupTests(saved, testService.findTestsByIds(testIds));
    }
    return TestGroupDetail.fromEntity(saved, testIds == null ? List.of() : testIds);
  }

  @DeleteMapping("/groups/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteGroup(@PathVariable Long id) {
    TestGroupEntity entity = testService.findGroupById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    testService.deleteGroup(entity);
  }

  private static void apply(TestEntity entity, TestRequest request) {
    entity.setTestName(request.testName());
    entity.setShortcut(request.shortcut());
    entity.setCategory(request.category());
    entity.setPrice(request.price());
    entity.setActive(request.isActive());
    entity.setHasParameters(request.hasParameters());
    entity.setHasDefaultResults(request.hasDefaultResults());
    entity.setAllowMultipleResults(request.allowMultipleResults());
  }

  private static TestRequest normalize(TestRequest request) {
    if (request == null) {
      return null;
    }
    return new TestRequest(
      normalizeText(request.testName()),
      normalizeText(request.shortcut()),
      normalizeText(request.category()),
      request.price(),
      request.isActive(),
      request.hasParameters(),
      request.hasDefaultResults(),
      request.allowMultipleResults()
    );
  }

  private static void validate(TestRequest request) {
    if (request == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required.");
    }
    if (isBlank(request.testName())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Test name is required.");
    }
    if (isBlank(request.shortcut())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shortcut is required.");
    }
    if (isBlank(request.category())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category is required.");
    }
    if (request.price() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price is required.");
    }
    if (request.price().signum() < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price must be zero or greater.");
    }
  }

  private static String normalizeText(String value) {
    return value == null ? null : value.trim();
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }

  private static void apply(TestGroupEntity entity, TestGroupRequest request) {
    entity.setGroupName(request.groupName());
    entity.setShortcut(request.shortcut());
    entity.setCategory(request.category());
    entity.setPrice(request.price());
  }

  public record TestRequest(
    String testName,
    String shortcut,
    String category,
    BigDecimal price,
    boolean isActive,
    boolean hasParameters,
    boolean hasDefaultResults,
    boolean allowMultipleResults
  ) {
  }

  public record TestGroupRequest(
    String groupName,
    String shortcut,
    String category,
    BigDecimal price,
    List<Long> testIds
  ) {
  }

  public record TestSummary(
    Long id,
    String testName,
    String shortcut,
    String category,
    BigDecimal price,
    boolean isActive
  ) {
    public static TestSummary fromEntity(TestEntity entity) {
      return new TestSummary(
        entity.getId(),
        entity.getTestName(),
        entity.getShortcut(),
        entity.getCategory(),
        entity.getPrice(),
        entity.isActive()
      );
    }
  }

  public record TestDetail(
    Long id,
    String testName,
    String shortcut,
    String category,
    BigDecimal price,
    boolean isActive,
    boolean hasParameters,
    boolean hasDefaultResults,
    boolean allowMultipleResults
  ) {
    public static TestDetail fromEntity(TestEntity entity) {
      return new TestDetail(
        entity.getId(),
        entity.getTestName(),
        entity.getShortcut(),
        entity.getCategory(),
        entity.getPrice(),
        entity.isActive(),
        entity.isHasParameters(),
        entity.isHasDefaultResults(),
        entity.isAllowMultipleResults()
      );
    }
  }

  public record TestGroupSummary(
    Long id,
    String groupName,
    String shortcut,
    String category,
    BigDecimal price,
    List<Long> testIds
  ) {
    public static TestGroupSummary fromEntity(TestGroupEntity entity, List<Long> testIds) {
      return new TestGroupSummary(
        entity.getId(),
        entity.getGroupName(),
        entity.getShortcut(),
        entity.getCategory(),
        entity.getPrice(),
        testIds
      );
    }
  }

  public record TestGroupDetail(
    Long id,
    String groupName,
    String shortcut,
    String category,
    BigDecimal price,
    List<Long> testIds
  ) {
    public static TestGroupDetail fromEntity(TestGroupEntity entity, List<Long> testIds) {
      return new TestGroupDetail(
        entity.getId(),
        entity.getGroupName(),
        entity.getShortcut(),
        entity.getCategory(),
        entity.getPrice(),
        testIds
      );
    }
  }
}

package com.ssdc.lab.controller;

import com.ssdc.lab.domain.test.TestDefaultResultEntity;
import com.ssdc.lab.domain.test.TestEntity;
import com.ssdc.lab.domain.test.TestEntityFactory;
import com.ssdc.lab.domain.test.TestGroupEntity;
import com.ssdc.lab.domain.test.TestParameterEntity;
import com.ssdc.lab.service.TestService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tests")
public class TestController {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
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
    List<TestParameterEntity> parameters = testService.findParametersByTestId(entity.getId());
    List<TestDefaultResultEntity> defaults = testService.findDefaultResultsByTestId(entity.getId());
    return TestDetail.fromEntity(entity, parameters, defaults);
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
    persistParametersAndDefaults(saved, normalized);
    List<TestParameterEntity> parameters = testService.findParametersByTestId(saved.getId());
    List<TestDefaultResultEntity> defaults = testService.findDefaultResultsByTestId(saved.getId());
    return ResponseEntity.status(HttpStatus.CREATED).body(TestDetail.fromEntity(saved, parameters, defaults));
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
    persistParametersAndDefaults(saved, normalized);
    List<TestParameterEntity> parameters = testService.findParametersByTestId(saved.getId());
    List<TestDefaultResultEntity> defaults = testService.findDefaultResultsByTestId(saved.getId());
    return TestDetail.fromEntity(saved, parameters, defaults);
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

  private void persistParametersAndDefaults(TestEntity saved, TestRequest request) {
    if (saved == null || request == null) {
      return;
    }
    if (request.parameters() == null) {
      return;
    }
    List<NormalizedParameter> normalizedParameters = normalizeParameters(request.parameters());
    List<TestParameterEntity> parameterEntities = toParameterEntities(normalizedParameters);
    List<TestDefaultResultEntity> defaultEntities = toDefaultEntities(normalizedParameters);
    testService.replaceParameters(saved, parameterEntities);
    testService.replaceDefaultResults(saved, defaultEntities);
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
      request.allowMultipleResults(),
      request.parameters()
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
    if (request.hasParameters() && request.parameters() != null) {
      List<TestParameterRequest> params = request.parameters();
      if (params == null || params.isEmpty()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parameters are required.");
      }
      for (TestParameterRequest param : params) {
        if (param == null || isBlank(param.valueType())) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Value type is required.");
        }
      }
    }
  }

  private static String normalizeText(String value) {
    return value == null ? null : value.trim();
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }

  private static List<NormalizedParameter> normalizeParameters(List<TestParameterRequest> parameters) {
    if (parameters == null || parameters.isEmpty()) {
      return List.of();
    }
    List<NormalizedParameter> normalized = new ArrayList<>();
    int index = 1;
    for (TestParameterRequest request : parameters) {
      if (request == null) {
        continue;
      }
      String name = normalizeText(request.name());
      if (isBlank(name)) {
        name = "Parameter " + index;
      }
      String unit = normalizeText(request.unit());
      if (unit == null) {
        unit = "";
      }
      TestParameterEntity.ValueType valueType = parseValueType(request.valueType());
      List<String> defaultResults = normalizeStringList(request.defaultResults());
      normalized.add(new NormalizedParameter(name, unit, valueType, defaultResults));
      index++;
    }
    return normalized;
  }

  private static List<TestParameterEntity> toParameterEntities(List<NormalizedParameter> parameters) {
    if (parameters == null || parameters.isEmpty()) {
      return List.of();
    }
    List<TestParameterEntity> entities = new ArrayList<>();
    for (NormalizedParameter param : parameters) {
      TestParameterEntity entity = TestEntityFactory.createTestParameter();
      entity.setParameterName(param.name());
      entity.setUnit(param.unit());
      entity.setValueType(param.valueType());
      entities.add(entity);
    }
    return entities;
  }

  private static List<TestDefaultResultEntity> toDefaultEntities(List<NormalizedParameter> parameters) {
    if (parameters == null || parameters.isEmpty()) {
      return List.of();
    }
    List<TestDefaultResultEntity> defaults = new ArrayList<>();
    for (NormalizedParameter param : parameters) {
      if (param.defaultResults() == null || param.defaultResults().isEmpty()) {
        continue;
      }
      for (String value : param.defaultResults()) {
        if (isBlank(value)) {
          continue;
        }
        TestDefaultResultEntity entity = TestEntityFactory.createTestDefaultResult();
        entity.setDefaultValue(encodeDefaultValue(param.name(), value.trim()));
        defaults.add(entity);
      }
    }
    return defaults;
  }

  private static List<String> normalizeStringList(List<String> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    List<String> cleaned = new ArrayList<>();
    for (String value : values) {
      String trimmed = normalizeText(value);
      if (!isBlank(trimmed)) {
        cleaned.add(trimmed);
      }
    }
    return cleaned;
  }

  private static TestParameterEntity.ValueType parseValueType(String value) {
    if (isBlank(value)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Value type is required.");
    }
    try {
      return TestParameterEntity.ValueType.valueOf(value.trim().toUpperCase());
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid value type.");
    }
  }

  private static String encodeDefaultValue(String parameterName, String value) {
    if (isBlank(parameterName)) {
      return value;
    }
    try {
      var node = OBJECT_MAPPER.createObjectNode();
      node.put("param", parameterName);
      node.put("value", value);
      return OBJECT_MAPPER.writeValueAsString(node);
    } catch (JsonProcessingException ex) {
      return value;
    }
  }

  private static TestDefaultResultDetail decodeDefaultValue(TestDefaultResultEntity entity) {
    if (entity == null || entity.getDefaultValue() == null) {
      return null;
    }
    String raw = entity.getDefaultValue().trim();
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        JsonNode node = OBJECT_MAPPER.readTree(raw);
        String value = node.path("value").asText(null);
        String param = node.path("param").asText(null);
        if (value != null) {
          return new TestDefaultResultDetail(isBlank(param) ? null : param, value);
        }
      } catch (Exception ignored) {
        // Fall back to raw value.
      }
    }
    return new TestDefaultResultDetail(null, raw);
  }

  private record NormalizedParameter(
    String name,
    String unit,
    TestParameterEntity.ValueType valueType,
    List<String> defaultResults
  ) {
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
    boolean allowMultipleResults,
    List<TestParameterRequest> parameters
  ) {
  }

  public record TestParameterRequest(
    String name,
    String unit,
    String valueType,
    boolean allowMultiLine,
    List<String> defaultResults,
    List<NormalRangeRequest> normalRanges
  ) {
  }

  public record NormalRangeRequest(
    String textValue
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
    boolean allowMultipleResults,
    List<TestParameterDetail> parameters,
    List<TestDefaultResultDetail> defaultResults
  ) {
    public static TestDetail fromEntity(TestEntity entity,
                                        List<TestParameterEntity> parameters,
                                        List<TestDefaultResultEntity> defaults) {
      List<TestParameterDetail> paramDetails = parameters == null ? List.of() :
        parameters.stream().map(TestParameterDetail::fromEntity).toList();
      List<TestDefaultResultDetail> defaultDetails = defaults == null ? List.of() :
        defaults.stream()
          .map(TestController::decodeDefaultValue)
          .filter(java.util.Objects::nonNull)
          .toList();
      return new TestDetail(
        entity.getId(),
        entity.getTestName(),
        entity.getShortcut(),
        entity.getCategory(),
        entity.getPrice(),
        entity.isActive(),
        entity.isHasParameters(),
        entity.isHasDefaultResults(),
        entity.isAllowMultipleResults(),
        paramDetails,
        defaultDetails
      );
    }
  }

  public record TestParameterDetail(
    Long id,
    String name,
    String unit,
    String valueType
  ) {
    public static TestParameterDetail fromEntity(TestParameterEntity entity) {
      return new TestParameterDetail(
        entity.getId(),
        entity.getParameterName(),
        entity.getUnit(),
        entity.getValueType() == null ? null : entity.getValueType().name()
      );
    }
  }

  public record TestDefaultResultDetail(
    String parameterName,
    String value
  ) {
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

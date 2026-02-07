package com.ssdc.ssdclabs.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.ssdc.ssdclabs.dto.TestNormalValueDTO;
import com.ssdc.ssdclabs.dto.NormalRangePayload;
import com.ssdc.ssdclabs.dto.TestParameterPayload;
import com.ssdc.ssdclabs.dto.TestPayload;
import com.ssdc.ssdclabs.dto.TestParameterViewDTO;
import com.ssdc.ssdclabs.dto.TestUnitDTO;
import com.ssdc.ssdclabs.dto.TestViewDTO;
import com.ssdc.ssdclabs.model.Gender;
import com.ssdc.ssdclabs.model.NormalRange;
import com.ssdc.ssdclabs.model.Test;
import com.ssdc.ssdclabs.model.TestParameter;
import com.ssdc.ssdclabs.model.TestType;
import com.ssdc.ssdclabs.model.ValueType;
import com.ssdc.ssdclabs.repository.TestParameterRepository;
import com.ssdc.ssdclabs.repository.TestRepository;

@Service
public class TestService {

    private static final Pattern RANGE_PATTERN =
        Pattern.compile("^\\s*(-?\\d+(?:\\.\\d+)?)\\s*[-–]\\s*(-?\\d+(?:\\.\\d+)?)\\s*$");

    private final TestRepository testRepo;
    private final TestParameterRepository paramRepo;

    public TestService(TestRepository testRepo,
                       TestParameterRepository paramRepo) {
        this.testRepo = testRepo;
        this.paramRepo = paramRepo;
    }

    @Transactional(readOnly = true)
    public List<TestViewDTO> getAllTests(@NonNull String labId) {
        return testRepo.findByLabIdOrderByIdAsc(labId).stream()
            .map(this::toView)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TestViewDTO> getActiveTests(@NonNull String labId) {
        return testRepo.findByLabIdAndActiveTrueOrderByIdAsc(labId).stream()
            .map(this::toView)
            .collect(Collectors.toList());
    }

    @Transactional
    public @NonNull TestViewDTO createTest(@NonNull String labId,
                                           @NonNull TestPayload payload) {
        Test test = new Test();
        test.setLabId(Objects.requireNonNull(labId, "labId"));
        applyPayload(test, payload, Collections.emptyList());
        Test saved = testRepo.save(test);
        return toView(saved);
    }

    @Transactional
    public @NonNull TestViewDTO updateTest(@NonNull String labId,
                                           @NonNull Long id,
                                           @NonNull TestPayload payload) {
        Test test = testRepo.findByIdAndLabId(
                Objects.requireNonNull(id, "id"),
                Objects.requireNonNull(labId, "labId"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Test not found"));

        if (payload.testName != null) {
            test.setTestName(payload.testName.trim());
        }
        if (payload.category != null) {
            test.setCategory(payload.category.trim());
        }
        if (payload.shortcut != null) {
            test.setShortcut(payload.shortcut.trim());
        }
        if (payload.cost != null) {
            test.setCost(payload.cost);
        }
        if (payload.active != null) {
            test.setActive(payload.active);
        }
        if (payload.showTestNameInReport != null) {
            test.setShowTestNameInReport(payload.showTestNameInReport);
        }

        boolean shouldRebuild =
            payload.parameters != null
            || payload.units != null
            || payload.normalValues != null;

        List<TestParameter> existingParams =
            paramRepo.findByTest_IdOrderByIdAsc(test.getId());

        if (shouldRebuild) {
            boolean allowParameterRemoval = !testRepo.isTestUsed(labId, test.getId());
            List<TestParameter> params = updateParametersFromPayload(
                test,
                payload,
                existingParams,
                allowParameterRemoval
            );
            test.setTestType(determineTestType(params));
        } else if (test.getTestType() == null) {
            test.setTestType(determineTestType(existingParams));
        }

        if (test.getActive() == null) {
            test.setActive(true);
        }
        if (test.getShowTestNameInReport() == null) {
            test.setShowTestNameInReport(true);
        }

        Test saved = testRepo.save(test);
        return toView(saved);
    }

    @Transactional
    public void updateActive(@NonNull String labId,
                             @NonNull Long id,
                             boolean active) {
        Test test = testRepo.findByIdAndLabId(
                Objects.requireNonNull(id, "id"),
                Objects.requireNonNull(labId, "labId"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Test not found"));
        test.setActive(active);
        testRepo.save(test);
    }

    @Transactional
    public void deleteTest(@NonNull String labId, @NonNull Long id) {
        Test test = testRepo.findByIdAndLabId(
                Objects.requireNonNull(id, "id"),
                Objects.requireNonNull(labId, "labId"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Test not found"));
        testRepo.deleteById(test.getId());
    }

    private void applyPayload(Test test,
                              TestPayload payload,
                              List<TestParameter> existingParams) {
        if (payload.testName != null) {
            test.setTestName(payload.testName.trim());
        }
        if (payload.category != null) {
            test.setCategory(payload.category.trim());
        }
        if (payload.shortcut != null) {
            test.setShortcut(payload.shortcut.trim());
        }
        if (payload.cost != null) {
            test.setCost(payload.cost);
        }
        if (payload.active != null) {
            test.setActive(payload.active);
        }
        if (payload.showTestNameInReport != null) {
            test.setShowTestNameInReport(payload.showTestNameInReport);
        }

        boolean shouldRebuild =
            payload.parameters != null
            || payload.units != null
            || payload.normalValues != null
            || test.getId() == null;

        if (shouldRebuild) {
            List<TestParameter> params = buildParametersFromPayload(
                test,
                payload,
                existingParams
            );
            test.setParameters(params);
            test.setTestType(determineTestType(params));
        } else if (test.getTestType() == null) {
            test.setTestType(determineTestType(existingParams));
        }

        if (test.getActive() == null) {
            test.setActive(true);
        }

        if (test.getShowTestNameInReport() == null) {
            test.setShowTestNameInReport(true);
        }
    }

    private TestType determineTestType(List<TestParameter> params) {
        if (params == null || params.isEmpty()) {
            return TestType.SINGLE;
        }
        if (params.size() > 1) {
            return TestType.MULTI;
        }
        TestParameter param = params.get(0);
        if (param != null && ValueType.TEXT.equals(param.getValueType())) {
            return TestType.QUALITATIVE;
        }
        return TestType.SINGLE;
    }

    private List<TestParameter> updateParametersFromPayload(
            Test test,
            TestPayload payload,
            List<TestParameter> existingParams,
            boolean allowRemoval) {
        if (payload.parameters != null) {
            return updateParametersFromStructuredPayload(
                test,
                payload.parameters,
                existingParams,
                allowRemoval
            );
        }

        if (payload.units == null && payload.normalValues == null) {
            return existingParams == null ? List.of() : existingParams;
        }

        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Legacy parameter updates are not supported."
        );
    }

    private List<TestParameter> updateParametersFromStructuredPayload(
            Test test,
            List<TestParameterPayload> payloadParams,
            List<TestParameter> existingParams,
            boolean allowRemoval) {
        List<TestParameterPayload> cleaned = new ArrayList<>();
        if (payloadParams != null) {
            for (TestParameterPayload payloadParam : payloadParams) {
                if (payloadParam != null) {
                    cleaned.add(payloadParam);
                }
            }
        }

        if (cleaned.isEmpty()) {
            if (existingParams != null && !existingParams.isEmpty()) {
                return existingParams;
            }
            TestParameter param = new TestParameter();
            param.setTest(test);
            param.setName(test.getTestName() == null ? "Parameter 1" : test.getTestName());
            param.setValueType(ValueType.NUMBER);
            param.setNormalRanges(new ArrayList<>());
            paramRepo.save(param);
            return List.of(param);
        }

        boolean hasIds = false;
        for (TestParameterPayload payloadParam : cleaned) {
            if (payloadParam.id != null) {
                hasIds = true;
                break;
            }
        }

        if (hasIds) {
            return updateParametersById(test, cleaned, existingParams, allowRemoval);
        }

        return updateParametersByIndex(test, cleaned, existingParams, allowRemoval);
    }

    private List<TestParameter> updateParametersById(
            Test test,
            List<TestParameterPayload> payloadParams,
            List<TestParameter> existingParams,
            boolean allowRemoval) {
        Map<Long, TestParameter> existingById = new HashMap<>();
        if (existingParams != null) {
            for (TestParameter param : existingParams) {
                if (param != null && param.getId() != null) {
                    existingById.put(param.getId(), param);
                }
            }
        }

        Set<Long> seenExistingIds = new HashSet<>();
        List<TestParameter> updated = new ArrayList<>();

        int totalParams = payloadParams.size();
        int index = 0;
        for (TestParameterPayload payloadParam : payloadParams) {
            TestParameter param;
            if (payloadParam.id != null) {
                param = existingById.get(payloadParam.id);
                if (param == null) {
                    throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid parameter id: " + payloadParam.id
                    );
                }
                seenExistingIds.add(payloadParam.id);
            } else {
                param = new TestParameter();
                param.setTest(test);
            }

            applyStructuredParameterUpdate(param, payloadParam, index, totalParams, test);
            if (param.getId() == null) {
                paramRepo.save(param);
            }
            updated.add(param);
            index++;
        }

        List<TestParameter> removed = new ArrayList<>();
        if (existingParams != null) {
            for (TestParameter param : existingParams) {
                if (param == null || param.getId() == null) {
                    continue;
                }
                if (!seenExistingIds.contains(param.getId())) {
                    removed.add(param);
                }
            }
        }

        if (!removed.isEmpty()) {
            if (!allowRemoval) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot remove parameters because this test is already used in reports."
                );
            }
            paramRepo.deleteAll(removed);
        }

        return updated;
    }

    private List<TestParameter> updateParametersByIndex(
            Test test,
            List<TestParameterPayload> payloadParams,
            List<TestParameter> existingParams,
            boolean allowRemoval) {
        int existingCount = existingParams == null ? 0 : existingParams.size();
        int incomingCount = payloadParams.size();

        if (incomingCount < existingCount && !allowRemoval) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Cannot remove parameters because this test is already used in reports."
            );
        }
        if (incomingCount < existingCount) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Cannot remove parameters without parameter ids. Please refresh and try again."
            );
        }

        List<TestParameter> updated = new ArrayList<>();
        int totalParams = incomingCount;
        for (int i = 0; i < incomingCount; i++) {
            TestParameterPayload payloadParam = payloadParams.get(i);
            TestParameter param;
            if (i < existingCount) {
                param = existingParams.get(i);
            } else {
                param = new TestParameter();
                param.setTest(test);
            }

            applyStructuredParameterUpdate(param, payloadParam, i, totalParams, test);
            if (param.getId() == null) {
                paramRepo.save(param);
            }
            updated.add(param);
        }

        return updated;
    }

    private void applyStructuredParameterUpdate(
            TestParameter param,
            TestParameterPayload payloadParam,
            int index,
            int totalParams,
            Test test) {
        String name = trimToNull(payloadParam.name);
        if (name == null) {
            name = resolveParamName(
                List.of(),
                index,
                totalParams,
                test.getTestName()
            );
        }

        param.setName(name);
        param.setUnit(trimToNull(payloadParam.unit));
        param.setDefaultResult(serializeDefaultResults(payloadParam.defaultResults));
        param.setAllowNewLines(
            payloadParam.allowNewLines != null ? payloadParam.allowNewLines : Boolean.FALSE
        );

        List<NormalRange> ranges = new ArrayList<>();
        if (payloadParam.normalRanges != null) {
            for (NormalRangePayload raw : payloadParam.normalRanges) {
                NormalRange range = buildNormalRange(raw);
                if (range != null) {
                    range.setParameter(param);
                    ranges.add(range);
                }
            }
        }
        replaceNormalRanges(param, ranges);

        ValueType valueType = payloadParam.valueType;
        if (valueType == null) {
            valueType = determineValueType(ranges);
        }
        if (valueType == null) {
            valueType = ValueType.NUMBER;
        }
        param.setValueType(valueType);
    }

    private void replaceNormalRanges(TestParameter param, List<NormalRange> ranges) {
        if (param.getNormalRanges() == null) {
            param.setNormalRanges(ranges);
            return;
        }
        param.getNormalRanges().clear();
        param.getNormalRanges().addAll(ranges);
    }

    private List<TestParameter> buildParametersFromPayload(
            Test test,
            TestPayload payload,
            List<TestParameter> existingParams) {
        if (payload.parameters != null && !payload.parameters.isEmpty()) {
            return buildParametersFromStructuredPayload(test, payload.parameters);
        }
        return buildParameters(test, payload, existingParams);
    }

    private List<TestParameter> buildParametersFromStructuredPayload(
            Test test,
            List<TestParameterPayload> payloadParams) {
        List<TestParameter> params = new ArrayList<>();
        int totalParams = 0;
        for (TestParameterPayload payloadParam : payloadParams) {
            if (payloadParam != null) {
                totalParams++;
            }
        }
        int index = 0;
        for (TestParameterPayload payloadParam : payloadParams) {
            if (payloadParam == null) {
                continue;
            }
            String name = trimToNull(payloadParam.name);
            if (name == null) {
                name = resolveParamName(
                    List.of(),
                    index,
                    totalParams,
                    test.getTestName()
                );
            }

            TestParameter param = new TestParameter();
            param.setTest(test);
            param.setName(name);
            param.setUnit(trimToNull(payloadParam.unit));
            param.setDefaultResult(
                serializeDefaultResults(payloadParam.defaultResults)
            );
            param.setAllowNewLines(
                payloadParam.allowNewLines != null
                    ? payloadParam.allowNewLines
                    : Boolean.FALSE
            );

            List<NormalRange> ranges = new ArrayList<>();
            if (payloadParam.normalRanges != null) {
                for (NormalRangePayload raw : payloadParam.normalRanges) {
                    NormalRange range = buildNormalRange(raw);
                    if (range != null) {
                        range.setParameter(param);
                        ranges.add(range);
                    }
                }
            }
            param.setNormalRanges(ranges);

            ValueType valueType = payloadParam.valueType;
            if (valueType == null) {
                valueType = determineValueType(ranges);
            }
            if (valueType == null) {
                valueType = ValueType.NUMBER;
            }
            param.setValueType(valueType);

            params.add(param);
            index++;
        }

        if (params.isEmpty()) {
            TestParameter param = new TestParameter();
            param.setTest(test);
            param.setName(
                test.getTestName() == null ? "Parameter 1" : test.getTestName()
            );
            param.setValueType(ValueType.NUMBER);
            param.setNormalRanges(new ArrayList<>());
            params.add(param);
        }

        return params;
    }

    private List<TestParameter> buildParameters(
            Test test,
            TestPayload payload,
            List<TestParameter> existingParams) {
        List<String> units = extractUnits(payload, existingParams);
        List<String> normals = extractNormalValues(payload, existingParams);
        List<String> names = extractNames(existingParams);
        List<String> defaultResults = extractDefaultResults(existingParams);

        int count = Math.max(units.size(), normals.size());
        count = Math.max(count, names.size());
        if (count == 0) {
            count = 1;
        }

        boolean singleParam = count == 1;
        List<TestParameter> params = new ArrayList<>();

        for (int i = 0; i < count; i++) {
            TestParameter param = new TestParameter();
            param.setTest(test);
            param.setName(resolveParamName(
                names,
                i,
                count,
                payload.testName
            ));
            param.setUnit(i < units.size() ? units.get(i) : null);
            param.setDefaultResult(
                i < defaultResults.size() ? defaultResults.get(i) : null
            );

            List<NormalRange> ranges = new ArrayList<>();
            if (singleParam && normals.size() > 1) {
                for (String normal : normals) {
                    NormalRange range = parseNormalRange(normal);
                    if (range != null) {
                        range.setParameter(param);
                        ranges.add(range);
                    }
                }
            } else if (i < normals.size()) {
                NormalRange range = parseNormalRange(normals.get(i));
                if (range != null) {
                    range.setParameter(param);
                    ranges.add(range);
                }
            }
            param.setNormalRanges(ranges);
            ValueType valueType = determineValueType(ranges);
            param.setValueType(valueType);
            params.add(param);
        }

        return params;
    }

    private List<String> extractUnits(TestPayload payload,
                                      List<TestParameter> existingParams) {
        if (payload.units != null) {
            return payload.units.stream()
                .map(u -> u == null ? null : u.unit)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(v -> !v.isEmpty())
                .collect(Collectors.toList());
        }
        if (existingParams == null) {
            return List.of();
        }
        return existingParams.stream()
            .map(TestParameter::getUnit)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }

    private List<String> extractNormalValues(TestPayload payload,
                                             List<TestParameter> existingParams) {
        if (payload.normalValues != null) {
            return payload.normalValues.stream()
                .map(n -> n == null ? null : n.normalValue)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(v -> !v.isEmpty())
                .collect(Collectors.toList());
        }
        if (existingParams == null) {
            return List.of();
        }
        boolean multi = existingParams.size() > 1;
        if (existingParams.isEmpty()) {
            return List.of();
        }
        if (multi) {
            return existingParams.stream()
                .map(p -> formatNormalRanges(p.getNormalRanges()))
                .filter(v -> !v.isEmpty())
                .collect(Collectors.toList());
        }
        TestParameter param = existingParams.get(0);
        return param.getNormalRanges().stream()
            .map(this::formatNormalRange)
            .filter(v -> !v.isEmpty())
            .collect(Collectors.toList());
    }

    private List<String> extractNames(List<TestParameter> existingParams) {
        if (existingParams == null) {
            return List.of();
        }
        return existingParams.stream()
            .map(TestParameter::getName)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }

    private List<String> extractDefaultResults(List<TestParameter> existingParams) {
        if (existingParams == null) {
            return List.of();
        }
        List<String> results = new ArrayList<>();
        for (TestParameter param : existingParams) {
            results.add(param == null ? null : param.getDefaultResult());
        }
        return results;
    }

    private String resolveParamName(List<String> names,
                                    int index,
                                    int total,
                                    String testName) {
        if (index < names.size()) {
            return names.get(index);
        }
        if (total == 1 && testName != null && !testName.trim().isEmpty()) {
            return testName.trim();
        }
        return "Parameter " + (index + 1);
    }

    private NormalRange parseNormalRange(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        NormalRange range = new NormalRange();
        range.setGender(Gender.ANY);

        Matcher matcher = RANGE_PATTERN.matcher(trimmed);
        if (matcher.matches()) {
            range.setMinValue(parseDouble(matcher.group(1)));
            range.setMaxValue(parseDouble(matcher.group(2)));
            return range;
        }

        Double numeric = parseDouble(trimmed);
        if (numeric != null) {
            range.setMinValue(numeric);
            range.setMaxValue(numeric);
            return range;
        }

        range.setTextValue(trimmed);
        return range;
    }

    private ValueType determineValueType(List<NormalRange> ranges) {
        if (ranges == null || ranges.isEmpty()) {
            return ValueType.NUMBER;
        }
        for (NormalRange range : ranges) {
            if (range.getTextValue() != null && !range.getTextValue().isEmpty()) {
                return ValueType.TEXT;
            }
        }
        return ValueType.NUMBER;
    }

    private NormalRange buildNormalRange(NormalRangePayload raw) {
        if (raw == null) {
            return null;
        }
        String textValue = trimToNull(raw.textValue);
        boolean hasText = textValue != null;
        boolean hasMin = raw.minValue != null;
        boolean hasMax = raw.maxValue != null;
        if (!hasText && !hasMin && !hasMax) {
            return null;
        }
        if (hasText && (hasMin || hasMax)) {
            return null;
        }
        NormalRange range = new NormalRange();
        range.setGender(raw.gender == null ? Gender.ANY : raw.gender);
        if (hasText) {
            range.setTextValue(textValue);
        } else {
            range.setMinValue(raw.minValue);
            range.setMaxValue(raw.maxValue);
        }
        return range;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String serializeDefaultResults(List<String> defaultResults) {
        if (defaultResults == null || defaultResults.isEmpty()) {
            return null;
        }
        List<String> cleaned = new ArrayList<>();
        for (String value : defaultResults) {
            if (value == null) {
                continue;
            }
            String trimmed = value.trim();
            if (!trimmed.isEmpty()) {
                cleaned.add(trimmed);
            }
        }
        if (cleaned.isEmpty()) {
            return null;
        }
        return String.join("\n", cleaned);
    }

    private List<String> parseDefaultResults(String stored) {
        if (stored == null) {
            return List.of();
        }
        String trimmed = stored.trim();
        if (trimmed.isEmpty()) {
            return List.of();
        }
        String[] parts = trimmed.split("\\r?\\n");
        List<String> results = new ArrayList<>();
        for (String part : parts) {
            String value = part.trim();
            if (!value.isEmpty()) {
                results.add(value);
            }
        }
        return results;
    }

    @Transactional(readOnly = true)
    public @NonNull TestViewDTO toView(Test test) {
        List<TestParameter> params =
            paramRepo.findByTest_IdOrderByIdAsc(test.getId());
        boolean multi = params.size() > 1;
        List<TestUnitDTO> units = new ArrayList<>();
        List<TestNormalValueDTO> normalValues = new ArrayList<>();
        List<TestParameterViewDTO> parameterViews = new ArrayList<>();

        for (TestParameter param : params) {
            ValueType valueType =
                param.getValueType() == null ? ValueType.NUMBER : param.getValueType();
            parameterViews.add(new TestParameterViewDTO(
                param.getId(),
                param.getName(),
                param.getUnit(),
                valueType,
                formatNormalRanges(param.getNormalRanges()),
                parseDefaultResults(param.getDefaultResult()),
                param.getAllowNewLines()
            ));
        }

        if (multi) {
            for (TestParameter param : params) {
                units.add(new TestUnitDTO(param.getName()));
                normalValues.add(new TestNormalValueDTO(
                    formatNormalRanges(param.getNormalRanges())
                ));
            }
        } else if (!params.isEmpty()) {
            TestParameter param = params.get(0);
            units.add(new TestUnitDTO(param.getUnit() == null ? "" : param.getUnit()));
            List<NormalRange> ranges = param.getNormalRanges();
            if (ranges != null) {
                for (NormalRange range : ranges) {
                    String formatted = formatNormalRange(range);
                    if (!formatted.isEmpty()) {
                        normalValues.add(new TestNormalValueDTO(formatted));
                    }
                }
            }
        }

        return new TestViewDTO(
            test.getId(),
            test.getTestName(),
            test.getCategory(),
            test.getShortcut(),
            test.getCost(),
            test.getActive(),
            Boolean.FALSE.equals(test.getShowTestNameInReport()) ? Boolean.FALSE : Boolean.TRUE,
            units,
            normalValues,
            parameterViews
        );
    }

    private String formatNormalRanges(List<NormalRange> ranges) {
        if (ranges == null || ranges.isEmpty()) {
            return "";
        }
        return ranges.stream()
            .map(this::formatNormalRange)
            .filter(v -> !v.isEmpty())
            .collect(Collectors.joining(" / "));
    }

    private String formatNormalRange(NormalRange range) {
        if (range == null) {
            return "";
        }
        String base;
        if (range.getTextValue() != null && !range.getTextValue().isEmpty()) {
            base = range.getTextValue();
        } else if (range.getMinValue() != null || range.getMaxValue() != null) {
            String min = range.getMinValue() == null ? "" : formatNumber(range.getMinValue());
            String max = range.getMaxValue() == null ? "" : formatNumber(range.getMaxValue());
            base = min.isEmpty() || max.isEmpty() ? min + max : min + "-" + max;
        } else {
            base = "";
        }
        if (base.isEmpty()) {
            return "";
        }
        if (range.getGender() != null && range.getGender() != Gender.ANY) {
            String prefix = range.getGender() == Gender.MALE ? "M" : "F";
            return prefix + ": " + base;
        }
        return base;
    }

    private Double parseDouble(String value) {
        try {
            return Double.parseDouble(value.trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private String formatNumber(Double value) {
        if (value == null) {
            return "";
        }
        BigDecimal bd = BigDecimal.valueOf(value);
        BigDecimal stripped = bd.stripTrailingZeros();
        boolean isWhole = stripped.scale() <= 0;

        if (isWhole) {
            BigDecimal abs = bd.abs();
            if (abs.compareTo(BigDecimal.valueOf(100)) < 0) {
                return bd.setScale(1, RoundingMode.UNNECESSARY).toPlainString();
            }
            return bd.setScale(0, RoundingMode.UNNECESSARY).toPlainString();
        }

        return stripped.toPlainString();
    }
}

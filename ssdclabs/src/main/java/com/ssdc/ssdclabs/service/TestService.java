package com.ssdc.ssdclabs.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    public List<TestViewDTO> getAllTests() {
        return testRepo.findAllByOrderByDisplayOrderAscTestNameAsc().stream()
            .map(this::toView)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TestViewDTO> getActiveTests() {
        return testRepo.findByActiveTrueOrderByDisplayOrderAscTestNameAsc().stream()
            .map(this::toView)
            .collect(Collectors.toList());
    }

    @Transactional
    public @NonNull TestViewDTO createTest(@NonNull TestPayload payload) {
        Test test = new Test();
        applyPayload(test, payload, Collections.emptyList());
        Test saved = testRepo.save(test);
        return toView(saved);
    }

    @Transactional
    public @NonNull TestViewDTO updateTest(@NonNull Long id,
                                           @NonNull TestPayload payload) {
        Test test = testRepo.findById(Objects.requireNonNull(id, "id"))
            .orElseThrow(() -> new RuntimeException("Test not found"));
        List<TestParameter> existingParams =
            paramRepo.findByTest_IdOrderByDisplayOrderAsc(test.getId());
        applyPayload(test, payload, existingParams);
        Test saved = testRepo.save(test);
        return toView(saved);
    }

    @Transactional
    public void updateActive(@NonNull Long id, boolean active) {
        Test test = testRepo.findById(Objects.requireNonNull(id, "id"))
            .orElseThrow(() -> new RuntimeException("Test not found"));
        test.setActive(active);
        testRepo.save(test);
    }

    @Transactional
    public void deleteTest(@NonNull Long id) {
        testRepo.deleteById(Objects.requireNonNull(id, "id"));
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
        int index = 0;
        for (TestParameterPayload payloadParam : payloadParams) {
            if (payloadParam == null) {
                continue;
            }
            String name = trimToNull(payloadParam.name);
            if (name == null) {
                continue;
            }

            TestParameter param = new TestParameter();
            param.setTest(test);
            param.setName(name);
            param.setUnit(trimToNull(payloadParam.unit));
            param.setDisplayOrder(
                payloadParam.displayOrder == null ? index : payloadParam.displayOrder
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
            param.setDisplayOrder(0);
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
            param.setDisplayOrder(i);
            param.setName(resolveParamName(
                names,
                i,
                count,
                payload.testName
            ));
            param.setUnit(i < units.size() ? units.get(i) : null);

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
            param.setValueType(determineValueType(ranges));
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
            if (range.getMinValue() != null || range.getMaxValue() != null) {
                return ValueType.RANGE;
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

    @Transactional(readOnly = true)
    public @NonNull TestViewDTO toView(Test test) {
        List<TestParameter> params =
            paramRepo.findByTest_IdOrderByDisplayOrderAsc(test.getId());
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
                formatNormalRanges(param.getNormalRanges())
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

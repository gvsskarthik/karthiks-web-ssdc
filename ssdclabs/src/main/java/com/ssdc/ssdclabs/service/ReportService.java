package com.ssdc.ssdclabs.service;

import com.ssdc.ssdclabs.AppConstants;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
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

import com.ssdc.ssdclabs.dto.PatientAppReportDTO;
import com.ssdc.ssdclabs.dto.PatientTestResultDTO;
import com.ssdc.ssdclabs.dto.PatientTestSelectionDTO;
import com.ssdc.ssdclabs.model.Gender;
import com.ssdc.ssdclabs.model.NormalRange;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.model.ReportResult;
import com.ssdc.ssdclabs.model.Test;
import com.ssdc.ssdclabs.model.TestParameter;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.repository.ReportResultRepository;
import com.ssdc.ssdclabs.repository.TestParameterRepository;
import com.ssdc.ssdclabs.repository.TestRepository;

@Service
public class ReportService {

    private static final Pattern EXTRA_SUFFIX_PATTERN =
        Pattern.compile("^extra-(\\d+)$", Pattern.CASE_INSENSITIVE);

    private final ReportResultRepository resultRepo;
    private final TestRepository testRepo;
    private final TestParameterRepository paramRepo;
    private final PatientRepository patientRepo;

    public ReportService(ReportResultRepository resultRepo,
                         TestRepository testRepo,
                         TestParameterRepository paramRepo,
                         PatientRepository patientRepo) {
        this.resultRepo = resultRepo;
        this.testRepo = testRepo;
        this.paramRepo = paramRepo;
        this.patientRepo = patientRepo;
    }

    private boolean isCompleted(Patient patient) {
        if (patient == null) {
            return false;
        }
        String status = patient.getStatus();
        return PatientService.STATUS_COMPLETED.equalsIgnoreCase(
            status == null ? "" : status.trim()
        );
    }

    private static boolean isValidCompletedEditPin(String editPin) {
        return AppConstants.isValidCompletedEditPin(editPin);
    }

    @Transactional
    public void saveSelectedTests(String labId,
                                  List<PatientTestSelectionDTO> selections,
                                  String editPin) {
        if (selections == null || selections.isEmpty()) {
            return;
        }

        Long patientId = selections.get(0).patientId;
        if (patientId == null) {
            return;
        }

        Patient patient = patientRepo.findByIdAndLabId(patientId, labId).orElse(null);
        if (patient == null) {
            return;
        }
        if (isCompleted(patient) && !isValidCompletedEditPin(editPin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Report is completed and locked");
        }

        Set<Long> selectedTestIds = new LinkedHashSet<>();
        for (PatientTestSelectionDTO selection : selections) {
            if (selection == null || selection.testId == null) {
                continue;
            }
            selectedTestIds.add(selection.testId);
        }

        if (selectedTestIds.isEmpty()) {
            return;
        }

        List<ReportResult> existingResults =
            resultRepo.findByPatient_Id(labId, patientId);

        Map<Long, Map<Long, ReportResult>> byTestParam = new HashMap<>();
        for (ReportResult result : existingResults) {
            if (result.getTest() == null || result.getParameter() == null) {
                continue;
            }
            Long testId = result.getTest().getId();
            Long paramId = result.getParameter().getId();
            if (testId == null || paramId == null) {
                continue;
            }
            byTestParam
                .computeIfAbsent(testId, k -> new HashMap<>())
                .put(paramId, result);
        }

        List<ReportResult> toDelete = new ArrayList<>();
        for (ReportResult result : existingResults) {
            if (result.getTest() == null || result.getTest().getId() == null) {
                continue;
            }
            Long testId = result.getTest().getId();
            if (!selectedTestIds.contains(testId)
                    && isBlank(result.getResultValue())) {
                toDelete.add(result);
            }
        }

        List<ReportResult> toSave = new ArrayList<>();
        for (Long testId : selectedTestIds) {
            Long safeTestId = Objects.requireNonNull(testId, "testId");
            Test testEntity = testRepo.findByIdAndLabId(safeTestId, labId).orElse(null);
            if (testEntity == null) {
                continue;
            }
            List<TestParameter> params =
                paramRepo.findByTest_IdOrderByIdAsc(safeTestId);
            if (params.isEmpty()) {
                continue;
            }
            Map<Long, ReportResult> existingByParam =
                byTestParam.getOrDefault(safeTestId, Map.of());
            Test testRef = testEntity;

            for (TestParameter param : params) {
                if (param.getId() == null) {
                    continue;
                }
                ReportResult existing = existingByParam.get(param.getId());
                if (existing != null) {
                    continue;
                }
                ReportResult result = new ReportResult();
                result.setPatient(patient);
                result.setTest(testRef);
                result.setParameter(param);
                result.setSubTest("");
                result.setResultValue(firstDefaultResult(param));
                toSave.add(result);
            }
        }

        if (!toDelete.isEmpty()) {
            resultRepo.deleteAll(toDelete);
        }
        if (!toSave.isEmpty()) {
            resultRepo.saveAll(toSave);
        }
    }

    @Transactional
    public void saveResults(String labId,
                            List<PatientTestResultDTO> results,
                            String editPin) {
        if (results == null || results.isEmpty()) {
            return;
        }

        Set<Long> touchedPatients = new HashSet<>();
        Map<Long, Patient> patientCache = new HashMap<>();
        Map<Long, Test> testCache = new HashMap<>();
        Map<Long, List<TestParameter>> paramCache = new HashMap<>();
        Map<String, TestParameter> paramByNameCache = new HashMap<>();

        record GroupKey(Long patientId, Long testId, Long parameterId) {}
        class IncomingLine {
            final int sortKey;
            final int seq;
            final String value;
            IncomingLine(int sortKey, int seq, String value) {
                this.sortKey = sortKey;
                this.seq = seq;
                this.value = value;
            }
        }

        Map<GroupKey, List<IncomingLine>> incomingByGroup = new LinkedHashMap<>();
        Map<GroupKey, Patient> groupPatient = new HashMap<>();
        Map<GroupKey, Test> groupTest = new HashMap<>();
        Map<GroupKey, TestParameter> groupParam = new HashMap<>();
        Set<GroupKey> clearRequested = new HashSet<>();

        int seq = 0;
        for (PatientTestResultDTO incoming : results) {
            if (incoming == null) {
                seq++;
                continue;
            }
            Long patientId = incoming.patientId;
            Long testId = incoming.testId;
            if (patientId == null || testId == null) {
                seq++;
                continue;
            }

            boolean wantsClear = Boolean.TRUE.equals(incoming.clear);
            String cleanedValue = normalizeResultValue(incoming.resultValue);
            if (isBlank(cleanedValue) && !wantsClear) {
                seq++;
                continue;
            }

            touchedPatients.add(patientId);

            Long safePatientId = Objects.requireNonNull(patientId, "patientId");
            Long safeTestId = Objects.requireNonNull(testId, "testId");

            Patient patient = patientCache.computeIfAbsent(
                safePatientId,
                id -> patientRepo.findByIdAndLabId(
                        Objects.requireNonNull(id, "patientId"),
                        Objects.requireNonNull(labId, "labId"))
                    .orElse(null)
            );
            if (patient == null) {
                seq++;
                continue;
            }
            if (isCompleted(patient) && !isValidCompletedEditPin(editPin)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Report is completed and locked");
            }
            Test test = testCache.computeIfAbsent(
                safeTestId,
                id -> testRepo.findByIdAndLabId(
                        Objects.requireNonNull(id, "testId"),
                        Objects.requireNonNull(labId, "labId"))
                    .orElse(null)
            );
            if (test == null) {
                seq++;
                continue;
            }

            List<TestParameter> params = paramCache.computeIfAbsent(
                safeTestId,
                id -> paramRepo.findByTest_IdOrderByIdAsc(
                    Objects.requireNonNull(id, "testId"))
            );
            if (params.isEmpty()) {
                seq++;
                continue;
            }

            String normalizedSubTest = normalizeSubTest(incoming.subTest);
            TestParameter param = resolveParameter(
                params,
                normalizedSubTest,
                paramByNameCache,
                safeTestId
            );
            if (param == null || param.getId() == null) {
                seq++;
                continue;
            }

            GroupKey key = new GroupKey(patientId, testId, param.getId());
            groupPatient.putIfAbsent(key, patient);
            groupTest.putIfAbsent(key, test);
            groupParam.putIfAbsent(key, param);

            if (!isBlank(cleanedValue)) {
                incomingByGroup.computeIfAbsent(key, k -> new ArrayList<>())
                    .add(new IncomingLine(
                        computeLineSortKey(normalizedSubTest, seq),
                        seq,
                        cleanedValue
                    ));
            } else if (wantsClear) {
                clearRequested.add(key);
            }
            seq++;
        }

        if (incomingByGroup.isEmpty() && clearRequested.isEmpty()) {
            return;
        }

        Map<GroupKey, List<ReportResult>> existingByGroup = new HashMap<>();
        List<Long> patientIdList = touchedPatients.stream()
            .filter(Objects::nonNull)
            .toList();
        if (!patientIdList.isEmpty()) {
            List<ReportResult> allExisting = resultRepo.findByPatient_IdIn(labId, patientIdList);
            for (ReportResult result : allExisting) {
                if (result == null || result.getPatient() == null) {
                    continue;
                }
                Long patientId = result.getPatient().getId();
                if (patientId == null) {
                    continue;
                }
                if (result.getTest() == null || result.getParameter() == null) {
                    continue;
                }
                Long testId = result.getTest().getId();
                Long paramId = result.getParameter().getId();
                if (testId == null || paramId == null) {
                    continue;
                }
                GroupKey key = new GroupKey(patientId, testId, paramId);
                existingByGroup
                    .computeIfAbsent(key, k -> new ArrayList<>())
                    .add(result);
            }
        }

        List<ReportResult> toSave = new ArrayList<>();
        List<ReportResult> toDelete = new ArrayList<>();

        for (Map.Entry<GroupKey, List<IncomingLine>> entry
                : incomingByGroup.entrySet()) {
            GroupKey key = entry.getKey();
            List<IncomingLine> lines = entry.getValue();
            if (lines == null || lines.isEmpty()) {
                continue;
            }
            lines.sort((a, b) -> {
                int cmp = Integer.compare(a.sortKey, b.sortKey);
                if (cmp != 0) {
                    return cmp;
                }
                return Integer.compare(a.seq, b.seq);
            });
            List<String> values = new ArrayList<>();
            for (IncomingLine line : lines) {
                if (line == null || isBlank(line.value)) {
                    continue;
                }
                values.add(line.value.trim());
            }
            if (values.isEmpty()) {
                continue;
            }
            String combined = String.join("\n", values);

            Patient patient = groupPatient.get(key);
            Test test = groupTest.get(key);
            TestParameter param = groupParam.get(key);
            if (patient == null || test == null || param == null) {
                continue;
            }

            List<ReportResult> existing = existingByGroup.getOrDefault(key, List.of());
            ReportResult base = pickBaseResult(existing, param.getName());
            if (base == null) {
                base = new ReportResult();
                base.setPatient(patient);
                base.setTest(test);
                base.setParameter(param);
                base.setSubTest("");
            }

            base.setResultValue(combined);
            toSave.add(base);

            for (ReportResult result : existing) {
                if (result == null || result == base) {
                    continue;
                }
                String sub = normalizeSubTest(result.getSubTest());
                if (sub != null && sub.contains("::")) {
                    toDelete.add(result);
                }
            }
        }

        for (GroupKey key : clearRequested) {
            if (incomingByGroup.containsKey(key)) {
                continue; // values win
            }

            Patient patient = groupPatient.get(key);
            Test test = groupTest.get(key);
            TestParameter param = groupParam.get(key);
            if (patient == null || test == null || param == null) {
                continue;
            }

            List<ReportResult> existing = existingByGroup.getOrDefault(key, List.of());
            ReportResult base = pickBaseResult(existing, param.getName());
            if (base == null) {
                base = new ReportResult();
                base.setPatient(patient);
                base.setTest(test);
                base.setParameter(param);
                base.setSubTest("");
            }

            base.setResultValue(null);
            toSave.add(base);

            for (ReportResult result : existing) {
                if (result == null || result == base) {
                    continue;
                }
                String sub = normalizeSubTest(result.getSubTest());
                if (sub != null && sub.contains("::")) {
                    toDelete.add(result);
                    continue;
                }
                if (!isBlank(result.getResultValue())) {
                    result.setResultValue(null);
                    toSave.add(result);
                }
            }
        }

        if (!toDelete.isEmpty()) {
            resultRepo.deleteAll(toDelete);
        }
        if (!toSave.isEmpty()) {
            resultRepo.saveAll(toSave);
        }

    }

    @Transactional(readOnly = true)
    public List<PatientTestSelectionDTO> getSelectedTests(@NonNull String labId,
                                                         @NonNull Long patientId) {
        List<ReportResult> results = resultRepo.findByPatient_Id(
            Objects.requireNonNull(labId, "labId"),
            Objects.requireNonNull(patientId, "patientId"));
        Set<Long> orderedTestIds = new LinkedHashSet<>();
        for (ReportResult result : results) {
            if (result == null || result.getTest() == null) {
                continue;
            }
            Long id = result.getTest().getId();
            if (id != null) {
                orderedTestIds.add(id);
            }
        }

        List<PatientTestSelectionDTO> list = new ArrayList<>();
        for (Long testId : orderedTestIds) {
            list.add(new PatientTestSelectionDTO(patientId, testId));
        }
        return list;
    }

    @Transactional(readOnly = true)
    public List<PatientTestResultDTO> getResults(@NonNull String labId,
                                                 @NonNull Long patientId) {
        List<ReportResult> results = resultRepo.findByPatient_Id(
            Objects.requireNonNull(labId, "labId"),
            Objects.requireNonNull(patientId, "patientId"));
        Set<Long> uniqueTestIds = results.stream()
            .map(r -> r.getTest() == null ? null : r.getTest().getId())
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(HashSet::new));

        Map<Long, Integer> paramCount = new HashMap<>();
        if (!uniqueTestIds.isEmpty()) {
            List<TestParameterRepository.TestParamCount> counts =
                paramRepo.countByTestIds(new ArrayList<>(uniqueTestIds));
            for (TestParameterRepository.TestParamCount c : counts) {
                if (c == null || c.getTestId() == null || c.getParamCount() == null) {
                    continue;
                }
                long testId = c.getTestId();
                long count = c.getParamCount();
                if (count > Integer.MAX_VALUE) {
                    count = Integer.MAX_VALUE;
                }
                paramCount.put(testId, (int) count);
            }
        }

        List<PatientTestResultDTO> response = new ArrayList<>();
        for (ReportResult result : results) {
            if (result.getTest() == null || result.getParameter() == null) {
                continue;
            }
            Long testId = result.getTest().getId();
            if (testId == null) {
                continue;
            }
            int count = paramCount.getOrDefault(testId, 0);
            String rawSubTest = normalizeSubTest(result.getSubTest());
            boolean isLineRow = rawSubTest != null && rawSubTest.contains("::");

            String baseSubTest = rawSubTest;
            if (isBlank(baseSubTest) && count > 1) {
                baseSubTest = result.getParameter().getName();
            }

            List<String> lines = splitResultLines(result.getResultValue());
            if (lines.isEmpty()) {
                response.add(new PatientTestResultDTO(
                    result.getId(),
                    patientId,
                    testId,
                    baseSubTest,
                    result.getResultValue()
                ));
                continue;
            }

            if (isLineRow) {
                response.add(new PatientTestResultDTO(
                    result.getId(),
                    patientId,
                    testId,
                    rawSubTest,
                    lines.get(0)
                ));
                continue;
            }

            String prefix = isBlank(baseSubTest)
                ? result.getParameter().getName()
                : baseSubTest;

            for (int i = 0; i < lines.size(); i++) {
                String value = lines.get(i);
                String subOut;
                if (i == 0) {
                    subOut = baseSubTest;
                } else if (isBlank(prefix)) {
                    subOut = null;
                } else {
                    subOut = prefix + "::" + (i + 1);
                }
                response.add(new PatientTestResultDTO(
                    result.getId(),
                    patientId,
                    testId,
                    subOut,
                    value
                ));
            }
        }
        return response;
    }

    private int computeLineSortKey(String subTest, int seq) {
        if (subTest == null) {
            return 0;
        }
        int sep = subTest.indexOf("::");
        if (sep < 0) {
            return 0;
        }
        String suffix = subTest.substring(sep + 2).trim();
        if (suffix.isEmpty()) {
            return 0;
        }
        try {
            return Integer.parseInt(suffix);
        } catch (NumberFormatException ignored) {
            Matcher matcher = EXTRA_SUFFIX_PATTERN.matcher(suffix);
            if (matcher.matches()) {
                try {
                    int n = Integer.parseInt(matcher.group(1));
                    return 1000 + n;
                } catch (NumberFormatException ignored2) {
                    return 2000 + seq;
                }
            }
        }
        return 2000 + seq;
    }

    private ReportResult pickBaseResult(List<ReportResult> existing,
                                        String paramName) {
        if (existing == null || existing.isEmpty()) {
            return null;
        }
        ReportResult blank = null;
        ReportResult named = null;
        ReportResult firstNonLine = null;

        String normalizedParam = paramName == null ? null : paramName.trim();
        for (ReportResult result : existing) {
            if (result == null) {
                continue;
            }
            String sub = normalizeSubTest(result.getSubTest());
            if (isBlank(sub)) {
                blank = result;
                break;
            }
            if (named == null && normalizedParam != null && sub != null
                    && sub.equalsIgnoreCase(normalizedParam)) {
                named = result;
            }
            if (firstNonLine == null && sub != null && !sub.contains("::")) {
                firstNonLine = result;
            }
        }
        if (blank != null) {
            return blank;
        }
        if (named != null) {
            return named;
        }
        return firstNonLine;
    }

    private List<String> splitResultLines(String stored) {
        if (stored == null) {
            return List.of();
        }
        String trimmed = stored.trim();
        if (trimmed.isEmpty()) {
            return List.of();
        }
        String[] parts = trimmed.split("\\r?\\n");
        List<String> lines = new ArrayList<>();
        for (String part : parts) {
            if (part == null) {
                continue;
            }
            String value = part.trim();
            if (!value.isEmpty()) {
                lines.add(value);
            }
        }
        return lines;
    }

    private TestParameter resolveParameter(List<TestParameter> params,
                                           String subTest,
                                           Map<String, TestParameter> cache,
                                           Long testId) {
        String baseName = extractBaseName(subTest);
        if (isBlank(baseName)) {
            return params.get(0);
        }
        String key = testId + "::" + baseName.trim().toLowerCase();
        if (cache.containsKey(key)) {
            return cache.get(key);
        }
        for (TestParameter param : params) {
            if (param.getName() != null
                    && param.getName().equalsIgnoreCase(baseName.trim())) {
                cache.put(key, param);
                return param;
            }
        }
        return params.get(0);
    }

    private String normalizeSubTest(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        // Match MySQL VARCHAR default (and avoid "Data too long" errors).
        if (trimmed.length() > 255) {
            return trimmed.substring(0, 255);
        }
        return trimmed;
    }

    private String extractBaseName(String subTest) {
        if (subTest == null) {
            return null;
        }
        String trimmed = subTest.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        int sep = trimmed.indexOf("::");
        if (sep < 0) {
            return trimmed;
        }
        String base = trimmed.substring(0, sep).trim();
        return base.isEmpty() ? null : base;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String firstDefaultResult(TestParameter param) {
        if (param == null) {
            return null;
        }
        String stored = param.getDefaultResult();
        if (isBlank(stored)) {
            return null;
        }
        for (String part : stored.split("\\r?\\n")) {
            if (!isBlank(part)) {
                return part.trim();
            }
        }
        return null;
    }

    private String resolveFinalResult(String incomingValue, String defaultValue) {
        String cleanedIncoming = normalizeResultValue(incomingValue);
        if (!isBlank(cleanedIncoming)) {
            return cleanedIncoming;
        }
        String cleanedDefault = normalizeResultValue(defaultValue);
        if (!isBlank(cleanedDefault)) {
            return cleanedDefault;
        }
        return null;
    }

    private String normalizeResultValue(String value) {
        if (isBlank(value)) {
            return null;
        }
        // Preserve user-entered formatting (e.g. 4,000) so reports display
        // the same value the lab entered. Any numeric parsing for range checks
        // should normalize separators at the UI layer.
        return value.trim();
    }


    @Transactional(readOnly = true)
    public List<PatientAppReportDTO> getReportForApp(@NonNull String labId, @NonNull Long patientId) {
        List<PatientTestResultDTO> rawResults = getResults(labId, patientId);
        if (rawResults.isEmpty()) {
            return List.of();
        }

        Set<Long> testIds = rawResults.stream()
            .map(r -> r.testId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        if (testIds.isEmpty()) {
            return List.of();
        }

        List<Test> tests = testRepo.findAllById(testIds);
        Map<Long, Test> testMap = tests.stream()
            .collect(Collectors.toMap(Test::getId, t -> t));

        List<PatientAppReportDTO> enriched = new ArrayList<>();
        for (PatientTestResultDTO raw : rawResults) {
            Test test = testMap.get(raw.testId);
            if (test == null) continue;

            String paramName = extractBaseName(raw.subTest);
            TestParameter param = null;
            if (test.getParameters() != null) {
                for (TestParameter p : test.getParameters()) {
                     if (p.getName() != null && p.getName().equalsIgnoreCase(paramName)) {
                         param = p;
                         break;
                     }
                }
                if (param == null && !test.getParameters().isEmpty() && (paramName == null || paramName.isEmpty())) {
                     param = test.getParameters().get(0);
                }
            }

            String unit = "";
            String normal = "";

            if (param != null) {
                if (param.getUnit() != null) unit = param.getUnit();
                normal = formatNormalRanges(param.getNormalRanges());
            }

            enriched.add(new PatientAppReportDTO(
                raw.testId,
                test.getTestName(),
                raw.subTest,
                raw.resultValue,
                unit,
                normal
            ));
        }
        return enriched;
    }

    private String formatNormalRanges(List<NormalRange> ranges) {
        if (ranges == null || ranges.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (NormalRange range : ranges) {
            if (sb.length() > 0) sb.append("\n");
            if (range.getTextValue() != null && !range.getTextValue().trim().isEmpty()) {
                sb.append(range.getTextValue());
            } else {
                if (range.getGender() != Gender.ANY) {
                    sb.append(range.getGender().name().substring(0, 1)).append(": ");
                }
                if (range.getMinValue() != null && range.getMaxValue() != null) {
                    sb.append(range.getMinValue()).append("-").append(range.getMaxValue());
                } else if (range.getMinValue() != null) {
                    sb.append(">").append(range.getMinValue());
                } else if (range.getMaxValue() != null) {
                    sb.append("<").append(range.getMaxValue());
                }
            }
        }
        return sb.toString();
    }
}

package com.ssdc.ssdclabs.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssdc.ssdclabs.dto.PatientTestResultDTO;
import com.ssdc.ssdclabs.dto.PatientTestSelectionDTO;
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

    @Transactional
    public void saveSelectedTests(List<PatientTestSelectionDTO> selections) {
        if (selections == null || selections.isEmpty()) {
            return;
        }

        Long patientId = selections.get(0).patientId;
        if (patientId == null) {
            return;
        }

        Patient patient = patientRepo.findById(patientId).orElse(null);
        if (patient == null) {
            return;
        }

        Set<Long> selectedTestIds = selections.stream()
            .map(s -> s == null ? null : s.testId)
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(HashSet::new));

        if (selectedTestIds.isEmpty()) {
            return;
        }

        List<ReportResult> existingResults =
            resultRepo.findByPatient_Id(patientId);

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
            List<TestParameter> params =
                paramRepo.findByTest_IdOrderByIdAsc(safeTestId);
            if (params.isEmpty()) {
                continue;
            }
            Map<Long, ReportResult> existingByParam =
                byTestParam.getOrDefault(safeTestId, Map.of());
            Test testRef = testRepo.getReferenceById(safeTestId);

            for (TestParameter param : params) {
                if (param.getId() == null) {
                    continue;
                }
                ReportResult existing = existingByParam.get(param.getId());
                if (existing != null) {
                    if (isBlank(existing.getResultValue())) {
                        String defaultValue = firstDefaultResult(param);
                        if (!isBlank(defaultValue)) {
                            existing.setResultValue(defaultValue);
                            toSave.add(existing);
                        }
                    }
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
    public void saveResults(List<PatientTestResultDTO> results) {
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

            String cleanedValue = normalizeResultValue(incoming.resultValue);
            if (isBlank(cleanedValue)) {
                seq++;
                continue;
            }

            touchedPatients.add(patientId);

            Long safePatientId = Objects.requireNonNull(patientId, "patientId");
            Long safeTestId = Objects.requireNonNull(testId, "testId");

            Patient patient = patientCache.computeIfAbsent(
                safePatientId,
                id -> patientRepo.findById(Objects.requireNonNull(id, "patientId"))
                    .orElse(null)
            );
            if (patient == null) {
                seq++;
                continue;
            }
            Test test = testCache.computeIfAbsent(
                safeTestId,
                id -> testRepo.findById(Objects.requireNonNull(id, "testId"))
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
            incomingByGroup.computeIfAbsent(key, k -> new ArrayList<>())
                .add(new IncomingLine(
                    computeLineSortKey(normalizedSubTest, seq),
                    seq,
                    cleanedValue
                ));
            groupPatient.putIfAbsent(key, patient);
            groupTest.putIfAbsent(key, test);
            groupParam.putIfAbsent(key, param);
            seq++;
        }

        if (incomingByGroup.isEmpty()) {
            return;
        }

        Map<GroupKey, List<ReportResult>> existingByGroup = new HashMap<>();
        for (Long patientId : touchedPatients) {
            if (patientId == null) {
                continue;
            }
            List<ReportResult> existing = resultRepo.findByPatient_Id(patientId);
            for (ReportResult result : existing) {
                if (result == null || result.getTest() == null
                        || result.getParameter() == null) {
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

        if (!toDelete.isEmpty()) {
            resultRepo.deleteAll(toDelete);
        }
        if (!toSave.isEmpty()) {
            resultRepo.saveAll(toSave);
        }

        // Backfill defaults for any blank results on the same patients.
        if (!touchedPatients.isEmpty()) {
            List<ReportResult> defaultsToSave = new ArrayList<>();
            for (Long patientId : touchedPatients) {
                if (patientId == null) {
                    continue;
                }
                List<ReportResult> existing =
                    resultRepo.findByPatient_Id(patientId);
                for (ReportResult result : existing) {
                    if (result == null || !isBlank(result.getResultValue())) {
                        continue;
                    }
                    String defaultValue =
                        firstDefaultResult(result.getParameter());
                    String finalValue = resolveFinalResult(null, defaultValue);
                    if (!isBlank(finalValue)) {
                        result.setResultValue(finalValue);
                        defaultsToSave.add(result);
                    }
                }
            }
            if (!defaultsToSave.isEmpty()) {
                resultRepo.saveAll(defaultsToSave);
            }
        }

        // Update patient status based on whether all results are filled.
        for (Long patientId : touchedPatients) {
            if (patientId == null) {
                continue;
            }
            updatePatientStatus(patientId);
        }
    }

    @Transactional(readOnly = true)
    public List<PatientTestSelectionDTO> getSelectedTests(@NonNull Long patientId) {
        List<ReportResult> results = resultRepo.findByPatient_Id(
            Objects.requireNonNull(patientId, "patientId"));
        Set<Long> testIds = results.stream()
            .map(r -> r.getTest() == null ? null : r.getTest().getId())
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(HashSet::new));
        return testIds.stream()
            .map(id -> new PatientTestSelectionDTO(patientId, id))
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PatientTestResultDTO> getResults(@NonNull Long patientId) {
        List<ReportResult> results = resultRepo.findByPatient_Id(
            Objects.requireNonNull(patientId, "patientId"));
        Map<Long, Integer> paramCount = new HashMap<>();

        List<PatientTestResultDTO> response = new ArrayList<>();
        for (ReportResult result : results) {
            if (result.getTest() == null || result.getParameter() == null) {
                continue;
            }
            Long testId = result.getTest().getId();
            if (testId == null) {
                continue;
            }
            int count = paramCount.computeIfAbsent(
                testId,
                id -> paramRepo.findByTest_IdOrderByIdAsc(id).size()
            );
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

    private void updatePatientStatus(Long patientId) {
        Patient patient = patientRepo.findById(
            Objects.requireNonNull(patientId, "patientId")
        ).orElse(null);
        if (patient == null) {
            return;
        }

        List<ReportResult> results = resultRepo.findByPatient_Id(patientId);
        boolean allFilled = !results.isEmpty()
            && results.stream().allMatch(r -> r != null && !isBlank(r.getResultValue()));

        String next = allFilled ? "COMPLETE" : "NOT COMPLETE";
        if (patient.getStatus() == null || !patient.getStatus().equalsIgnoreCase(next)) {
            patient.setStatus(next);
            patientRepo.save(patient);
        }
    }
}

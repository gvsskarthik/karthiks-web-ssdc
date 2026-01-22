package com.ssdc.ssdclabs.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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

        List<ReportResult> toSave = new ArrayList<>();

        for (PatientTestResultDTO incoming : results) {
            if (incoming == null) {
                continue;
            }
            Long patientId = incoming.patientId;
            Long testId = incoming.testId;
            if (patientId == null || testId == null) {
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
                continue;
            }
            Test test = testCache.computeIfAbsent(
                safeTestId,
                id -> testRepo.findById(Objects.requireNonNull(id, "testId"))
                    .orElse(null)
            );
            if (test == null) {
                continue;
            }

            List<TestParameter> params = paramCache.computeIfAbsent(
                safeTestId,
                id -> paramRepo.findByTest_IdOrderByIdAsc(
                    Objects.requireNonNull(id, "testId"))
            );
            if (params.isEmpty()) {
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
                continue;
            }

            ReportResult result = resultRepo
                .findFirstByPatient_IdAndTest_IdAndParameter_IdAndSubTest(
                    patientId,
                    testId,
                    param.getId(),
                    normalizedSubTest
                )
                .orElseGet(() -> {
                    if (normalizedSubTest == null) {
                        return resultRepo
                            .findFirstByPatient_IdAndTest_IdAndParameter_IdAndSubTestIsNull(
                                patientId,
                                testId,
                                param.getId()
                            )
                            .orElseGet(ReportResult::new);
                    }
                    return new ReportResult();
                });

            // Don't overwrite existing values with blank input.
            if (isBlank(incoming.resultValue)
                    && result.getId() != null
                    && !isBlank(result.getResultValue())) {
                continue;
            }

            result.setPatient(patient);
            result.setTest(test);
            result.setParameter(param);
            result.setSubTest(normalizedSubTest);
            result.setResultValue(incoming.resultValue);
            toSave.add(result);
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
                    if (!isBlank(defaultValue)) {
                        result.setResultValue(defaultValue);
                        defaultsToSave.add(result);
                    }
                }
            }
            if (!defaultsToSave.isEmpty()) {
                resultRepo.saveAll(defaultsToSave);
            }
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
            String subTest = normalizeSubTest(result.getSubTest());
            if (isBlank(subTest) && count > 1) {
                subTest = result.getParameter().getName();
            }
            response.add(new PatientTestResultDTO(
                result.getId(),
                patientId,
                testId,
                subTest,
                result.getResultValue()
            ));
        }
        return response;
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
        return trimmed.isEmpty() ? null : trimmed;
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
}

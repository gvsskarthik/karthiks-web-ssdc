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

import com.ssdc.ssdclabs.dto.PatientTestObservationDTO;
import com.ssdc.ssdclabs.dto.PatientTestResultDTO;
import com.ssdc.ssdclabs.dto.PatientTestSelectionDTO;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.model.ReportObservation;
import com.ssdc.ssdclabs.model.ReportResult;
import com.ssdc.ssdclabs.model.Test;
import com.ssdc.ssdclabs.model.TestParameter;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.repository.ReportObservationRepository;
import com.ssdc.ssdclabs.repository.ReportResultRepository;
import com.ssdc.ssdclabs.repository.TestParameterRepository;
import com.ssdc.ssdclabs.repository.TestRepository;

@Service
public class ReportService {

    private final ReportResultRepository resultRepo;
    private final ReportObservationRepository observationRepo;
    private final TestRepository testRepo;
    private final TestParameterRepository paramRepo;
    private final PatientRepository patientRepo;

    public ReportService(ReportResultRepository resultRepo,
                         ReportObservationRepository observationRepo,
                         TestRepository testRepo,
                         TestParameterRepository paramRepo,
                         PatientRepository patientRepo) {
        this.resultRepo = resultRepo;
        this.observationRepo = observationRepo;
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
                paramRepo.findByTest_IdOrderByDisplayOrderAsc(safeTestId);
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
                if (existingByParam.containsKey(param.getId())) {
                    continue;
                }
                ReportResult result = new ReportResult();
                result.setPatient(patient);
                result.setTest(testRef);
                result.setParameter(param);
                result.setResultValue(null);
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
                id -> paramRepo.findByTest_IdOrderByDisplayOrderAsc(
                    Objects.requireNonNull(id, "testId"))
            );
            if (params.isEmpty()) {
                continue;
            }

            TestParameter param = resolveParameter(
                params,
                incoming.subTest,
                paramByNameCache,
                safeTestId
            );
            if (param == null || param.getId() == null) {
                continue;
            }

            ReportResult result = resultRepo
                .findFirstByPatient_IdAndTest_IdAndParameter_Id(
                    patientId,
                    testId,
                    param.getId()
                )
                .orElseGet(ReportResult::new);

            result.setPatient(patient);
            result.setTest(test);
            result.setParameter(param);
            result.setResultValue(incoming.resultValue);
            toSave.add(result);
        }

        if (!toSave.isEmpty()) {
            resultRepo.saveAll(toSave);
        }
    }

    @Transactional
    public void saveObservations(List<PatientTestObservationDTO> observations) {
        if (observations == null || observations.isEmpty()) {
            return;
        }

        Map<Long, Patient> patientCache = new HashMap<>();
        Map<Long, Test> testCache = new HashMap<>();
        List<ReportObservation> toSave = new ArrayList<>();

        for (PatientTestObservationDTO incoming : observations) {
            if (incoming == null) {
                continue;
            }
            Long patientId = incoming.patientId;
            Long testId = incoming.testId;
            if (patientId == null || testId == null) {
                continue;
            }

            observationRepo.deleteByPatient_IdAndTest_Id(patientId, testId);

            if (isBlank(incoming.observation)) {
                continue;
            }

            Patient patient = patientCache.computeIfAbsent(
                patientId,
                id -> patientRepo.findById(Objects.requireNonNull(id, "patientId"))
                    .orElse(null)
            );
            if (patient == null) {
                continue;
            }
            Test test = testCache.computeIfAbsent(
                testId,
                id -> testRepo.findById(Objects.requireNonNull(id, "testId"))
                    .orElse(null)
            );
            if (test == null) {
                continue;
            }

            ReportObservation obs = new ReportObservation();
            obs.setPatient(patient);
            obs.setTest(test);
            obs.setObservation(incoming.observation.trim());
            toSave.add(obs);
        }

        if (!toSave.isEmpty()) {
            observationRepo.saveAll(toSave);
        }
    }

    @Transactional(readOnly = true)
    public List<PatientTestObservationDTO> getObservations(@NonNull Long patientId) {
        List<ReportObservation> observations =
            observationRepo.findByPatient_Id(Objects.requireNonNull(patientId, "patientId"));

        List<PatientTestObservationDTO> response = new ArrayList<>();
        for (ReportObservation observation : observations) {
            if (observation.getTest() == null || observation.getTest().getId() == null) {
                continue;
            }
            response.add(new PatientTestObservationDTO(
                patientId,
                observation.getTest().getId(),
                observation.getObservation()
            ));
        }
        return response;
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
                id -> paramRepo.findByTest_IdOrderByDisplayOrderAsc(id).size()
            );
            String subTest = count > 1 ? result.getParameter().getName() : null;
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
        if (subTest == null || subTest.trim().isEmpty()) {
            return params.get(0);
        }
        String key = testId + "::" + subTest.trim().toLowerCase();
        if (cache.containsKey(key)) {
            return cache.get(key);
        }
        for (TestParameter param : params) {
            if (param.getName() != null
                    && param.getName().equalsIgnoreCase(subTest.trim())) {
                cache.put(key, param);
                return param;
            }
        }
        return params.get(0);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}

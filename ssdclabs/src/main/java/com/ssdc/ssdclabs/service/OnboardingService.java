package com.ssdc.ssdclabs.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssdc.ssdclabs.dto.OnboardingImportRequest;
import com.ssdc.ssdclabs.dto.OnboardingImportResponse;
import com.ssdc.ssdclabs.dto.OnboardingStatusDTO;
import com.ssdc.ssdclabs.dto.TemplateTestDTO;
import com.ssdc.ssdclabs.model.Lab;
import com.ssdc.ssdclabs.model.NormalRange;
import com.ssdc.ssdclabs.model.Test;
import com.ssdc.ssdclabs.model.TestGroup;
import com.ssdc.ssdclabs.model.TestGroupMapping;
import com.ssdc.ssdclabs.model.TestParameter;
import com.ssdc.ssdclabs.repository.LabRepository;
import com.ssdc.ssdclabs.repository.NormalRangeRepository;
import com.ssdc.ssdclabs.repository.TestGroupMappingRepository;
import com.ssdc.ssdclabs.repository.TestGroupRepository;
import com.ssdc.ssdclabs.repository.TestParameterRepository;
import com.ssdc.ssdclabs.repository.TestRepository;

@Service
public class OnboardingService {

    private final LabRepository labRepo;
    private final TestRepository testRepo;
    private final TestParameterRepository paramRepo;
    private final NormalRangeRepository rangeRepo;
    private final TestGroupRepository groupRepo;
    private final TestGroupMappingRepository mapRepo;
    private final String templateLabId;

    public OnboardingService(
            LabRepository labRepo,
            TestRepository testRepo,
            TestParameterRepository paramRepo,
            NormalRangeRepository rangeRepo,
            TestGroupRepository groupRepo,
            TestGroupMappingRepository mapRepo,
            @Value("${app.template.lab-id:admin1}") String templateLabId) {
        this.labRepo = Objects.requireNonNull(labRepo, "labRepo");
        this.testRepo = Objects.requireNonNull(testRepo, "testRepo");
        this.paramRepo = Objects.requireNonNull(paramRepo, "paramRepo");
        this.rangeRepo = Objects.requireNonNull(rangeRepo, "rangeRepo");
        this.groupRepo = Objects.requireNonNull(groupRepo, "groupRepo");
        this.mapRepo = Objects.requireNonNull(mapRepo, "mapRepo");
        this.templateLabId = Objects.requireNonNull(templateLabId, "templateLabId").trim().toLowerCase();
    }

    public String getTemplateLabId() {
        return templateLabId;
    }

    @Transactional(readOnly = true)
    public OnboardingStatusDTO getStatus(@NonNull String labId) {
        String safeLabId = Objects.requireNonNull(labId, "labId").trim().toLowerCase();
        if (safeLabId.equals(templateLabId)) {
            long count = testRepo.findByLabIdOrderByIdAsc(safeLabId).size();
            return new OnboardingStatusDTO(true, count);
        }

        Lab lab = labRepo.findById(safeLabId).orElse(null);
        if (lab == null) {
            return new OnboardingStatusDTO(true, 0);
        }
        boolean completed = Boolean.TRUE.equals(lab.getOnboardingCompleted());
        long testCount = testRepo.findByLabIdOrderByIdAsc(safeLabId).size();
        return new OnboardingStatusDTO(completed, testCount);
    }

    @Transactional
    public void skip(@NonNull String labId) {
        String safeLabId = Objects.requireNonNull(labId, "labId").trim().toLowerCase();
        if (safeLabId.equals(templateLabId)) {
            return;
        }
        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        lab.setOnboardingCompleted(Boolean.TRUE);
        labRepo.save(lab);
    }

    @Transactional(readOnly = true)
    public List<TemplateTestDTO> getTemplateTests(@NonNull String labId) {
        String safeLabId = Objects.requireNonNull(labId, "labId").trim().toLowerCase();
        if (safeLabId.equals(templateLabId)) {
            return List.of();
        }
        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        if (Boolean.TRUE.equals(lab.getOnboardingCompleted())) {
            throw new IllegalStateException("Onboarding already completed");
        }
        if (testRepo.countByLabId(safeLabId) > 0) {
            throw new IllegalStateException("Onboarding not available after adding tests");
        }

        List<Test> tests = testRepo.findByLabIdOrderByIdAsc(templateLabId);
        List<TemplateTestDTO> out = new ArrayList<>();
        for (Test test : tests) {
            if (test == null) {
                continue;
            }
            out.add(new TemplateTestDTO(
                test.getId(),
                test.getTestName(),
                test.getShortcut(),
                test.getCategory(),
                test.getCost(),
                test.getActive()
            ));
        }
        return out;
    }

    @Transactional
    public OnboardingImportResponse importFromTemplate(@NonNull String labId,
                                                      @NonNull OnboardingImportRequest request) {
        String safeLabId = Objects.requireNonNull(labId, "labId").trim().toLowerCase();
        if (safeLabId.equals(templateLabId)) {
            return new OnboardingImportResponse(0, 0, 0, 0, 0);
        }
        Lab lab = labRepo.findById(safeLabId).orElseThrow(() -> new IllegalArgumentException("Lab not found"));
        if (Boolean.TRUE.equals(lab.getOnboardingCompleted())) {
            throw new IllegalStateException("Onboarding already completed");
        }
        if (testRepo.countByLabId(safeLabId) > 0) {
            throw new IllegalStateException("Onboarding not available after adding tests");
        }

        String mode = request == null || request.mode == null ? "" : request.mode.trim().toUpperCase();
        Set<Long> selectedIds = new HashSet<>();
        if ("SELECTED".equals(mode) && request.testIds != null) {
            for (Long id : request.testIds) {
                if (id != null) {
                    selectedIds.add(id);
                }
            }
        }

        List<Test> templateTests = testRepo.findByLabIdOrderByIdAsc(templateLabId);
        List<Test> toImport = new ArrayList<>();
        for (Test test : templateTests) {
            if (test == null || test.getId() == null) {
                continue;
            }
            if ("ALL".equals(mode) || ("SELECTED".equals(mode) && selectedIds.contains(test.getId()))) {
                toImport.add(test);
            }
        }

        Map<Long, Long> templateTestIdToDestTestId = new HashMap<>();
        int testsImported = 0;
        int testsLinked = 0;

        for (Test template : toImport) {
            String shortcut = template.getShortcut();
            if (shortcut == null || shortcut.trim().isEmpty()) {
                continue;
            }
            Test existing = testRepo.findFirstByLabIdAndShortcutIgnoreCase(safeLabId, shortcut).orElse(null);
            if (existing != null && existing.getId() != null) {
                templateTestIdToDestTestId.put(template.getId(), existing.getId());
                testsLinked++;
                continue;
            }

            Test clone = new Test();
            clone.setLabId(safeLabId);
            clone.setTestName(template.getTestName());
            clone.setShortcut(template.getShortcut());
            clone.setCategory(template.getCategory());
            clone.setCost(template.getCost());
            clone.setActive(template.getActive());
            clone.setDisplayOrder(template.getDisplayOrder());
            clone.setTestType(template.getTestType());

            List<TestParameter> templateParams =
                paramRepo.findByTest_IdOrderByIdAsc(template.getId());
            List<TestParameter> clonedParams = new ArrayList<>();
            for (TestParameter templateParam : templateParams) {
                if (templateParam == null) {
                    continue;
                }
                TestParameter param = new TestParameter();
                param.setTest(clone);
                param.setName(templateParam.getName());
                param.setUnit(templateParam.getUnit());
                param.setValueType(templateParam.getValueType());
                param.setDefaultResult(templateParam.getDefaultResult());
                param.setAllowNewLines(templateParam.getAllowNewLines());

                List<NormalRange> templateRanges =
                    rangeRepo.findByParameter_Id(templateParam.getId());
                List<NormalRange> clonedRanges = new ArrayList<>();
                for (NormalRange templateRange : templateRanges) {
                    if (templateRange == null) {
                        continue;
                    }
                    NormalRange range = new NormalRange();
                    range.setParameter(param);
                    range.setGender(templateRange.getGender());
                    range.setMinValue(templateRange.getMinValue());
                    range.setMaxValue(templateRange.getMaxValue());
                    range.setTextValue(templateRange.getTextValue());
                    clonedRanges.add(range);
                }
                param.setNormalRanges(clonedRanges);
                clonedParams.add(param);
            }
            clone.setParameters(clonedParams);

            Test saved = testRepo.save(clone);
            testsImported++;
            templateTestIdToDestTestId.put(template.getId(), saved.getId());
        }

        // ===== Copy groups + mappings =====
        List<TestGroup> templateGroups = groupRepo.findByLabIdOrderByDisplayOrderAscGroupNameAsc(templateLabId);
        Map<Long, Long> templateGroupIdToDestGroupId = new HashMap<>();
        int groupsImported = 0;
        int groupsLinked = 0;

        for (TestGroup templateGroup : templateGroups) {
            if (templateGroup == null || templateGroup.getId() == null) {
                continue;
            }
            String shortcut = templateGroup.getShortcut();
            if (shortcut == null || shortcut.trim().isEmpty()) {
                continue;
            }
            TestGroup existing = groupRepo.findFirstByLabIdAndShortcutIgnoreCase(safeLabId, shortcut).orElse(null);
            if (existing != null && existing.getId() != null) {
                templateGroupIdToDestGroupId.put(templateGroup.getId(), existing.getId());
                groupsLinked++;
                continue;
            }

            TestGroup clone = new TestGroup();
            clone.setLabId(safeLabId);
            clone.setGroupName(templateGroup.getGroupName());
            clone.setShortcut(templateGroup.getShortcut());
            clone.setCost(templateGroup.getCost());
            clone.setCategory(templateGroup.getCategory());
            clone.setDisplayOrder(templateGroup.getDisplayOrder());
            clone.setActive(templateGroup.getActive());

            TestGroup saved = groupRepo.save(clone);
            groupsImported++;
            templateGroupIdToDestGroupId.put(templateGroup.getId(), saved.getId());
        }

        int mappingsImported = 0;
        List<Long> templateGroupIds = templateGroups.stream()
            .map(TestGroup::getId)
            .filter(Objects::nonNull)
            .toList();
        if (!templateGroupIds.isEmpty()) {
            List<TestGroupMapping> templateMappings =
                mapRepo.findByGroup_IdInOrderByGroup_IdAscDisplayOrderAsc(templateGroupIds);
            for (TestGroupMapping templateMapping : templateMappings) {
                if (templateMapping == null) {
                    continue;
                }
                TestGroup group = templateMapping.getGroup();
                Test test = templateMapping.getTest();
                Long templateGroupId = group == null ? null : group.getId();
                Long templateTestId = test == null ? null : test.getId();
                if (templateGroupId == null || templateTestId == null) {
                    continue;
                }
                Long destGroupId = templateGroupIdToDestGroupId.get(templateGroupId);
                Long destTestId = templateTestIdToDestTestId.get(templateTestId);
                if (destGroupId == null || destTestId == null) {
                    continue;
                }
                if (mapRepo.existsByGroup_IdAndTest_Id(destGroupId, destTestId)) {
                    continue;
                }
                TestGroupMapping clone = new TestGroupMapping();
                clone.setGroup(groupRepo.getReferenceById(destGroupId));
                clone.setTest(testRepo.getReferenceById(destTestId));
                clone.setDisplayOrder(templateMapping.getDisplayOrder());
                mapRepo.save(clone);
                mappingsImported++;
            }
        }

        lab.setOnboardingCompleted(Boolean.TRUE);
        labRepo.save(lab);

        return new OnboardingImportResponse(
            testsImported,
            testsLinked,
            groupsImported,
            groupsLinked,
            mappingsImported
        );
    }
}

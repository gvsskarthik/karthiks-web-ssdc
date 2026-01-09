package com.ssdc.ssdclabs.service;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssdc.ssdclabs.dto.TestGroupDetailDTO;
import com.ssdc.ssdclabs.dto.TestGroupPayload;
import com.ssdc.ssdclabs.model.Test;
import com.ssdc.ssdclabs.model.TestGroup;
import com.ssdc.ssdclabs.model.TestGroupMapping;
import com.ssdc.ssdclabs.repository.TestGroupMappingRepository;
import com.ssdc.ssdclabs.repository.TestGroupRepository;
import com.ssdc.ssdclabs.repository.TestRepository;

@Service
public class TestGroupService {

    private final TestGroupRepository groupRepo;
    private final TestGroupMappingRepository mapRepo;
    private final TestRepository testRepo;

    public TestGroupService(TestGroupRepository groupRepo,
                            TestGroupMappingRepository mapRepo,
                            TestRepository testRepo) {
        this.groupRepo = groupRepo;
        this.mapRepo = mapRepo;
        this.testRepo = testRepo;
    }

    public List<TestGroup> getAllGroups() {
        // Ordered by displayOrder, then groupName for stability.
        return groupRepo.findAllByOrderByDisplayOrderAscGroupNameAsc();
    }

    public TestGroupDetailDTO getGroup(@NonNull Long id) {
        TestGroup group = groupRepo.findById(Objects.requireNonNull(id, "id"))
            .orElseThrow(() -> new RuntimeException("Group not found"));
        List<Long> testIds = mapRepo.findByGroup_Id(id).stream()
            .map(m -> m.getTest().getId())
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
        return new TestGroupDetailDTO(
            group.getId(),
            group.getGroupName(),
            group.getShortcut(),
            group.getCost(),
            testIds
        );
    }

    @Transactional
    public String saveGroup(@NonNull TestGroupPayload payload) {
        String shortcut = Objects.requireNonNull(payload.shortcut, "shortcut");
        if (groupRepo.existsByShortcut(shortcut)) {
            throw new RuntimeException("Group shortcut already exists");
        }

        TestGroup group = new TestGroup();
        group.setGroupName(payload.groupName);
        group.setShortcut(shortcut);
        group.setCost(payload.cost == null ? 0.0 : payload.cost);
        group = groupRepo.save(group);

        saveMappings(group, payload.testIds);

        return "GROUP_SAVED";
    }

    @Transactional
    public String updateGroup(@NonNull Long id,
                              @NonNull TestGroupPayload payload) {
        TestGroup group = groupRepo.findById(Objects.requireNonNull(id, "id"))
            .orElseThrow(() -> new RuntimeException("Group not found"));

        String shortcut = Objects.requireNonNull(payload.shortcut, "shortcut");
        if (!shortcut.equalsIgnoreCase(group.getShortcut())
                && groupRepo.existsByShortcut(shortcut)) {
            throw new RuntimeException("Group shortcut already exists");
        }

        group.setGroupName(payload.groupName);
        group.setShortcut(shortcut);
        group.setCost(payload.cost == null ? 0.0 : payload.cost);
        groupRepo.save(group);

        mapRepo.deleteByGroup_Id(group.getId());
        saveMappings(group, payload.testIds);

        return "GROUP_UPDATED";
    }

    @Transactional
    public void deleteGroup(@NonNull Long id) {
        mapRepo.deleteByGroup_Id(Objects.requireNonNull(id, "id"));
        groupRepo.deleteById(id);
    }

    private void saveMappings(TestGroup group, List<Long> testIds) {
        if (testIds == null) {
            return;
        }
        int position = 0;
        for (Long testId : testIds) {
            Test test = testRepo.findById(
                    Objects.requireNonNull(testId, "testId"))
                .orElseThrow(() -> new RuntimeException("Test not found: " + testId));

            TestGroupMapping map = new TestGroupMapping();
            map.setGroup(group);
            map.setTest(test);
            map.setDisplayOrder(position++);

            mapRepo.save(map);
        }
    }
}

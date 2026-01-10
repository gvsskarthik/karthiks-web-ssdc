package com.ssdc.ssdclabs.service;

import java.util.*;

import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.dto.GroupDTO;
import com.ssdc.ssdclabs.dto.TestDTO;
import com.ssdc.ssdclabs.model.Test;
import com.ssdc.ssdclabs.model.TestGroup;
import com.ssdc.ssdclabs.model.TestGroupMapping;
import com.ssdc.ssdclabs.repository.TestRepository;

@Service
public class TestHierarchyService {

    private final TestRepository repo;

    public TestHierarchyService(TestRepository repo) {
        this.repo = repo;
    }

    public Map<String, Object> getHierarchy() {

        /* 🔥 ORDERED DATA FROM DB */
        List<TestGroupMapping> mappings = repo.findAllActiveOrdered();
        List<Test> activeTests =
            repo.findByActiveTrueOrderByDisplayOrderAscTestNameAsc();

        Map<String, Object> response = new LinkedHashMap<>();

        /* ===============================
           STEP 1: GROUP BY CATEGORY
           =============================== */
        Map<String, List<TestGroupMapping>> byCategory = new LinkedHashMap<>();

        for (TestGroupMapping gm : mappings) {
            Test test = gm.getTest();
            String category = normalizeCategory(test.getCategory());
            byCategory
                .computeIfAbsent(category, k -> new ArrayList<>())
                .add(gm);
        }

        for (Test test : activeTests) {
            String category = normalizeCategory(test.getCategory());
            byCategory.computeIfAbsent(category, k -> new ArrayList<>());
        }

        /* ===============================
           STEP 2: BUILD CATEGORY BLOCKS
           =============================== */
        for (String category : byCategory.keySet()) {

            List<TestGroupMapping> categoryMaps = byCategory.get(category);

            /* GROUP_ID → GroupDTO */
            Map<Long, GroupDTO> groupMap = new LinkedHashMap<>();

            for (TestGroupMapping gm : categoryMaps) {

                TestGroup g = gm.getGroup();
                Test t = gm.getTest();

                groupMap.computeIfAbsent(
                    g.getId(),
                    id -> new GroupDTO(
                        g.getId(),
                        g.getGroupName(),
                        g.getShortcut(),
                        g.getCost(),
                        new ArrayList<>()
                    )
                ).tests().add(   // ✅ FIX IS HERE
                    new TestDTO(
                        t.getId(),
                        t.getTestName(),
                        t.getShortcut(),
                        t.getCost()
                    )
                );
            }

            /* ===============================
               STEP 3: SINGLE TESTS
               =============================== */
            Set<Long> groupedTestIds = new HashSet<>();
            for (TestGroupMapping gm : categoryMaps) {
                groupedTestIds.add(gm.getTest().getId());
            }

            // Ordered by displayOrder, then testName for stable fallback.
            List<TestDTO> singleTests = activeTests.stream()
                .filter(t -> normalizeCategory(t.getCategory()).equals(category))
                .filter(t -> !groupedTestIds.contains(t.getId()))
                .map(t -> new TestDTO(
                        t.getId(),
                        t.getTestName(),
                        t.getShortcut(),
                        t.getCost()
                ))
                .toList();

            /* ===============================
               STEP 4: FINAL BLOCK
               =============================== */
            Map<String, Object> block = new LinkedHashMap<>();
            block.put("groups", new ArrayList<>(groupMap.values()));
            block.put("singleTests", singleTests);

            response.put(category, block);
        }

        return response;
    }

    private String normalizeCategory(String category) {
        if (category == null) {
            return "General";
        }
        String trimmed = category.trim();
        return trimmed.isEmpty() ? "General" : trimmed;
    }
}

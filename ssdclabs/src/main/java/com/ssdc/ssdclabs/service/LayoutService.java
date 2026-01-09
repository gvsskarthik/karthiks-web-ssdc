package com.ssdc.ssdclabs.service;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssdc.ssdclabs.repository.TestRepository;
import com.ssdc.ssdclabs.repository.TestGroupRepository;

@Service
public class LayoutService {

    private final TestRepository testRepo;
    private final TestGroupRepository groupRepo;

    public LayoutService(TestRepository testRepo,
                         TestGroupRepository groupRepo) {
        this.testRepo = testRepo;
        this.groupRepo = groupRepo;
    }

    @Transactional
    public void save(List<Map<String, Object>> list) {

        for (Map<String, Object> row : list) {

            String type = (String) row.get("type");
            int order = (int) row.get("order");

            /* ===== GROUP ORDER ===== */
            if ("group".equals(type)) {
                Long id = ((Number) row.get("id")).longValue();
                groupRepo.updateOrder(id, order);
            }

            /* ===== TEST ORDER ===== */
            if ("test".equals(type)) {
                Long id = ((Number) row.get("id")).longValue();
                testRepo.updateOrder(id, order);
            }

            /* ===== TEST INSIDE GROUP ===== */
            if ("group_test".equals(type)) {
                Long testId = ((Number) row.get("testId")).longValue();
                testRepo.updateOrder(testId, order);
            }
        }
    }
}
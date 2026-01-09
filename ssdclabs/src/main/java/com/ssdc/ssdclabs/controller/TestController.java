package com.ssdc.ssdclabs.controller;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.TestPayload;
import com.ssdc.ssdclabs.dto.TestViewDTO;
import com.ssdc.ssdclabs.repository.TestRepository;
import com.ssdc.ssdclabs.service.TestHierarchyService;
import com.ssdc.ssdclabs.service.TestService;

@RestController
@RequestMapping("/tests")
public class TestController {

    private final TestRepository repo;
    private final TestHierarchyService hierarchyService;
    private final TestService testService;

    public TestController(TestRepository repo,
                          TestHierarchyService hierarchyService,
                          TestService testService) {
        this.repo = repo;
        this.hierarchyService = hierarchyService;
        this.testService = testService;
    }

    /* ================= ADMIN : GET ALL TESTS ================= */
    @GetMapping
    public List<TestViewDTO> getAll() {
        return testService.getAllTests();
    }

    /* ================= STAFF / PATIENT : ACTIVE TESTS ================= */
    @GetMapping("/active")
    public List<TestViewDTO> getActive() {
        return testService.getActiveTests();
    }

    /* ================= CREATE TEST ================= */
    @PostMapping
    public @NonNull TestViewDTO save(@RequestBody @NonNull TestPayload test) {

        if (repo.existsByShortcut(test.shortcut)) {
            throw new RuntimeException("Shortcut already exists");
        }

        return testService.createTest(test);
    }

    /* ================= UPDATE TEST ================= */
    @PutMapping("/{id}")
    public ResponseEntity<TestViewDTO> update(
            @PathVariable @NonNull Long id,
            @RequestBody @NonNull TestPayload incoming) {

        if (incoming.shortcut != null
                && repo.existsByShortcut(incoming.shortcut)
                && repo.findById(id)
                       .map(t -> !incoming.shortcut.equalsIgnoreCase(t.getShortcut()))
                       .orElse(true)) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(
            testService.updateTest(
                Objects.requireNonNull(id, "id"),
                Objects.requireNonNull(incoming, "incoming")
            )
        );
    }

    /* ================= TOGGLE ACTIVE (ADMIN APPROVAL) ================= */
    @PutMapping("/{id}/active")
    public ResponseEntity<?> updateActive(
            @PathVariable @NonNull Long id,
            @RequestBody @NonNull Map<String, Boolean> body) {

        Boolean active = Objects.requireNonNull(body.get("active"), "active");
        testService.updateActive(id, active);

        return ResponseEntity.ok().build();
    }

    /* ================= DELETE TEST (SAFE) ================= */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable @NonNull Long id) {

        // 🔒 Block delete if used in report results
        if (repo.isTestUsed(Objects.requireNonNull(id, "id"))) {
            return ResponseEntity
                    .badRequest()
                    .body("❌ Cannot delete test. It is already used in reports.");
        }

        testService.deleteTest(id);
        return ResponseEntity.ok().build();
    }

    /* ================= TEST HIERARCHY ================= */
    @GetMapping("/hierarchy")
    public Map<String, Object> getHierarchy() {
        return hierarchyService.getHierarchy();
    }
}

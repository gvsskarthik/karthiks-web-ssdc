package com.ssdc.ssdclabs.controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.TestGroupDetailDTO;
import com.ssdc.ssdclabs.dto.TestGroupPayload;
import com.ssdc.ssdclabs.service.TestGroupService;

@RestController
@RequestMapping("/groups")
public class TestGroupController {

    private final TestGroupService groupService;

    public TestGroupController(
            TestGroupService groupService
    ) {
        this.groupService = groupService;
    }

    /* ===============================
       GET ALL GROUPS
       =============================== */
    @GetMapping
    public List<TestGroupDetailDTO> getAllGroups(@NonNull Principal principal) {
        return groupService.getAllGroups(principal.getName());
    }

    /* ===============================
       GET GROUP DETAILS
       =============================== */
    @GetMapping("/{id}")
    public TestGroupDetailDTO getGroup(@PathVariable @NonNull Long id,
                                       @NonNull Principal principal) {
        return groupService.getGroup(principal.getName(), id);
    }

    /* ===============================
       SAVE GROUP
       =============================== */
    @PostMapping
    public String saveGroup(@RequestBody @NonNull TestGroupPayload payload,
                            @NonNull Principal principal) {
        return groupService.saveGroup(principal.getName(), payload);
    }

    /* ===============================
       UPDATE GROUP
       =============================== */
    @PutMapping("/{id}")
    public String updateGroup(
            @PathVariable @NonNull Long id,
            @RequestBody @NonNull TestGroupPayload payload,
            @NonNull Principal principal) {
        return groupService.updateGroup(principal.getName(), id, payload);
    }

    /* ===============================
       TOGGLE ACTIVE (ADMIN APPROVAL)
       =============================== */
    @PutMapping("/{id}/active")
    public ResponseEntity<?> updateActive(
            @PathVariable @NonNull Long id,
            @RequestBody @NonNull Map<String, Boolean> body,
            @NonNull Principal principal) {

        Boolean active = Objects.requireNonNull(body.get("active"), "active");
        groupService.updateActive(principal.getName(), id, active);

        return ResponseEntity.ok().build();
    }

    /* ===============================
       DELETE GROUP
       =============================== */
    @DeleteMapping("/{id}")
    public void deleteGroup(@PathVariable @NonNull Long id,
                            @NonNull Principal principal) {
        groupService.deleteGroup(principal.getName(), id);
    }
}

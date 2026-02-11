package com.ssdc.ssdclabs.controller;

import java.security.Principal;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.HomeSummaryDTO;
import com.ssdc.ssdclabs.service.DashboardService;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/home-summary")
    public @NonNull HomeSummaryDTO homeSummary(
            @RequestParam(defaultValue = "20") int limit,
            @NonNull Principal principal) {
        return dashboardService.homeSummary(
            Objects.requireNonNull(principal.getName(), "labId"),
            limit
        );
    }
}


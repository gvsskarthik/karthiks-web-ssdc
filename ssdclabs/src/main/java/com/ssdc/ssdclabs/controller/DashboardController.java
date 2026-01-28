package com.ssdc.ssdclabs.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.DashboardStatsDTO;
import com.ssdc.ssdclabs.service.DashboardService;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/stats")
    public DashboardStatsDTO stats() {
        return service.getStats();
    }
}


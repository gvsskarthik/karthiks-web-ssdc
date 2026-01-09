package com.ssdc.ssdclabs.controller;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.*;

import com.ssdc.ssdclabs.service.LayoutService;

@RestController
@RequestMapping("/admin/layout")
public class LayoutController {

    private final LayoutService service;

    public LayoutController(LayoutService service) {
        this.service = service;
    }

    @PostMapping("/save")
    public void saveLayout(@RequestBody List<Map<String, Object>> payload) {
        service.save(payload);
    }
}

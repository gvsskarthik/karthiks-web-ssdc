package com.ssdc.ssdclabs.controller;

import java.security.Principal;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.PrintSettingsDTO;
import com.ssdc.ssdclabs.service.PrintSettingsService;

@RestController
@RequestMapping("/print-settings")
public class PrintSettingsController {

    private final PrintSettingsService service;

    public PrintSettingsController(PrintSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public @NonNull PrintSettingsDTO get(@NonNull Principal principal) {
        return service.getSettings(Objects.requireNonNull(principal.getName(), "labId"));
    }

    @PutMapping
    public @NonNull PrintSettingsDTO save(
            @RequestBody @NonNull PrintSettingsDTO incoming,
            @NonNull Principal principal) {
        return service.saveSettings(
            Objects.requireNonNull(principal.getName(), "labId"),
            Objects.requireNonNull(incoming, "incoming")
        );
    }
}


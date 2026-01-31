package com.ssdc.ssdclabs.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.LabPrintSettings;

public interface LabPrintSettingsRepository
        extends JpaRepository<LabPrintSettings, String> {
}


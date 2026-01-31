package com.ssdc.ssdclabs.service;

import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.dto.PrintSettingsDTO;
import com.ssdc.ssdclabs.model.LabPrintSettings;
import com.ssdc.ssdclabs.repository.LabPrintSettingsRepository;

@Service
public class PrintSettingsService {

    private static final int MAX_LINES = 200;

    private final LabPrintSettingsRepository repo;

    public PrintSettingsService(LabPrintSettingsRepository repo) {
        this.repo = repo;
    }

    public @NonNull PrintSettingsDTO getSettings(@NonNull String labId) {
        Objects.requireNonNull(labId, "labId");
        LabPrintSettings existing = repo.findById(labId).orElse(null);
        if (existing == null) {
            return new PrintSettingsDTO(0, 0, 0, 0);
        }
        return toDto(existing);
    }

    public @NonNull PrintSettingsDTO saveSettings(@NonNull String labId,
                                                  @NonNull PrintSettingsDTO incoming) {
        Objects.requireNonNull(labId, "labId");
        Objects.requireNonNull(incoming, "incoming");

        int top = normalizeLines(incoming.topLines);
        int bottom = normalizeLines(incoming.bottomLines);
        int left = normalizeLines(incoming.leftLines);
        int right = normalizeLines(incoming.rightLines);

        LabPrintSettings settings = repo.findById(labId).orElseGet(() -> {
            LabPrintSettings created = new LabPrintSettings();
            created.setLabId(labId);
            return created;
        });

        settings.setTopLines(top);
        settings.setBottomLines(bottom);
        settings.setLeftLines(left);
        settings.setRightLines(right);

        LabPrintSettings saved = repo.save(settings);
        return toDto(saved);
    }

    private static int normalizeLines(Integer value) {
        int v = value == null ? 0 : value;
        if (v < 0) return 0;
        if (v > MAX_LINES) return MAX_LINES;
        return v;
    }

    private static PrintSettingsDTO toDto(LabPrintSettings s) {
        return new PrintSettingsDTO(
            s.getTopLines() == null ? 0 : s.getTopLines(),
            s.getBottomLines() == null ? 0 : s.getBottomLines(),
            s.getLeftLines() == null ? 0 : s.getLeftLines(),
            s.getRightLines() == null ? 0 : s.getRightLines()
        );
    }
}


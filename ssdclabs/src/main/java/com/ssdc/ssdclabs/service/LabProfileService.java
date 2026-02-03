package com.ssdc.ssdclabs.service;

import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.dto.LabProfileDTO;
import com.ssdc.ssdclabs.model.Lab;
import com.ssdc.ssdclabs.repository.LabRepository;

@Service
public class LabProfileService {

    private static final int MAX_NAME_LENGTH = 120;

    private final LabRepository labRepo;

    public LabProfileService(LabRepository labRepo) {
        this.labRepo = Objects.requireNonNull(labRepo, "labRepo");
    }

    public @NonNull LabProfileDTO getProfile(@NonNull String labId) {
        Objects.requireNonNull(labId, "labId");
        Lab lab = labRepo.findById(labId).orElse(null);
        if (lab == null) {
            throw new IllegalArgumentException("Lab not found");
        }
        return new LabProfileDTO(lab.getLabId(), lab.getLabName());
    }

    public @NonNull LabProfileDTO updateLabName(@NonNull String labId, String incomingName) {
        Objects.requireNonNull(labId, "labId");
        String labName = trimToNull(incomingName);
        if (labName == null) {
            throw new IllegalArgumentException("Lab name is required");
        }
        if (labName.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Lab name is too long");
        }
        Lab lab = labRepo.findById(labId).orElse(null);
        if (lab == null) {
            throw new IllegalArgumentException("Lab not found");
        }
        lab.setLabName(labName);
        Lab saved = labRepo.save(lab);
        return new LabProfileDTO(saved.getLabId(), saved.getLabName());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String v = value.trim();
        return v.isEmpty() ? null : v;
    }
}


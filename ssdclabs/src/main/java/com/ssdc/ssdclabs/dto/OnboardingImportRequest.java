package com.ssdc.ssdclabs.dto;

import java.util.List;

public class OnboardingImportRequest {
    public String mode; // ALL | SELECTED
    public List<Long> testIds;
}


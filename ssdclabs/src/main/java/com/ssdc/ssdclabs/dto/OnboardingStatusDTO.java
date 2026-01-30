package com.ssdc.ssdclabs.dto;

public class OnboardingStatusDTO {
    public boolean onboardingCompleted;
    public long testCount;

    public OnboardingStatusDTO() {}

    public OnboardingStatusDTO(boolean onboardingCompleted, long testCount) {
        this.onboardingCompleted = onboardingCompleted;
        this.testCount = testCount;
    }
}


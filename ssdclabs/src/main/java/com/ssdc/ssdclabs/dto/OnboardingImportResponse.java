package com.ssdc.ssdclabs.dto;

public class OnboardingImportResponse {
    public int testsImported;
    public int testsLinked;
    public int groupsImported;
    public int groupsLinked;
    public int mappingsImported;

    public OnboardingImportResponse() {}

    public OnboardingImportResponse(int testsImported,
                                    int testsLinked,
                                    int groupsImported,
                                    int groupsLinked,
                                    int mappingsImported) {
        this.testsImported = testsImported;
        this.testsLinked = testsLinked;
        this.groupsImported = groupsImported;
        this.groupsLinked = groupsLinked;
        this.mappingsImported = mappingsImported;
    }
}


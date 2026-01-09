package com.ssdc.ssdclabs.dto;

public class PatientTestSelectionDTO {

    public Long patientId;
    public Long testId;

    public PatientTestSelectionDTO() {}

    public PatientTestSelectionDTO(Long patientId, Long testId) {
        this.patientId = patientId;
        this.testId = testId;
    }
}

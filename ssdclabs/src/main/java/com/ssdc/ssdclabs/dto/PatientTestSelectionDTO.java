package com.ssdc.ssdclabs.dto;

import java.math.BigDecimal;

public class PatientTestSelectionDTO {

    public Long patientId;
    public Long testId;
    public BigDecimal testOrder;

    @SuppressWarnings("unused")
    public PatientTestSelectionDTO() {}

    public PatientTestSelectionDTO(Long patientId, Long testId) {
        this.patientId = patientId;
        this.testId = testId;
    }

    public PatientTestSelectionDTO(Long patientId, Long testId, BigDecimal testOrder) {
        this.patientId = patientId;
        this.testId = testId;
        this.testOrder = testOrder;
    }
}

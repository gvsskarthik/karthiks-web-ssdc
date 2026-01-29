package com.ssdc.ssdclabs.dto;

import java.math.BigDecimal;

public class PatientTestResultDTO {

    public Long id;
    public Long patientId;
    public Long testId;
    public String subTest;
    public String resultValue;
    public BigDecimal testOrder;

    @SuppressWarnings("unused")
    public PatientTestResultDTO() {}

    public PatientTestResultDTO(Long id,
                                Long patientId,
                                Long testId,
                                String subTest,
                                String resultValue,
                                BigDecimal testOrder) {
        this.id = id;
        this.patientId = patientId;
        this.testId = testId;
        this.subTest = subTest;
        this.resultValue = resultValue;
        this.testOrder = testOrder;
    }
}

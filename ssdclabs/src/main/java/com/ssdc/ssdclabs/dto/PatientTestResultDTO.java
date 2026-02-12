package com.ssdc.ssdclabs.dto;

public class PatientTestResultDTO {

    public Long id;
    public Long patientId;
    public Long testId;
    public String subTest;
    public String resultValue;
    public Boolean clear;

    @SuppressWarnings("unused")
    public PatientTestResultDTO() {}

    public PatientTestResultDTO(Long id,
                                Long patientId,
                                Long testId,
                                String subTest,
                                String resultValue) {
        this.id = id;
        this.patientId = patientId;
        this.testId = testId;
        this.subTest = subTest;
        this.resultValue = resultValue;
    }
}

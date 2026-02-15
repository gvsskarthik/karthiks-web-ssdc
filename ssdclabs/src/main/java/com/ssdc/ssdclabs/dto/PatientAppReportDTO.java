package com.ssdc.ssdclabs.dto;

public class PatientAppReportDTO {
    public Long testId;
    public String testName;
    public String parameterName;
    public String resultValue;
    public String unit;
    public String normalRange;

    public PatientAppReportDTO(Long testId, String testName, String parameterName,
                               String resultValue, String unit, String normalRange) {
        this.testId = testId;
        this.testName = testName;
        this.parameterName = parameterName;
        this.resultValue = resultValue;
        this.unit = unit;
        this.normalRange = normalRange;
    }
}

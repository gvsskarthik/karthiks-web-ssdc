package com.ssdc.ssdclabs.dto;

public class PatientTestObservationDTO {

    public Long patientId;
    public Long testId;
    public String observation;

    @SuppressWarnings("unused")
    public PatientTestObservationDTO() {}

    public PatientTestObservationDTO(Long patientId,
                                     Long testId,
                                     String observation) {
        this.patientId = patientId;
        this.testId = testId;
        this.observation = observation;
    }
}

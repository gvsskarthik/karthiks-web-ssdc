package com.ssdc.ssdclabs.dto;

public record AccountsDuePatientDTO(
    Long patientId,
    String patientName,
    String mobile,
    String address,
    String doctorName,
    double dueAmount,
    String status
) {}


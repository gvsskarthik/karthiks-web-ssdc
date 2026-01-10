package com.ssdc.ssdclabs.dto;

public record AccountsDoctorDetailDTO(
    String date,
    String reportId,
    String patientName,
    double billAmount,
    double commissionAmount
) {}

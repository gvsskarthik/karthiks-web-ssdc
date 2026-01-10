package com.ssdc.ssdclabs.dto;

public record AccountsDoctorDTO(
    String doctorId,
    String doctorName,
    double commissionRate,
    long patientCount,
    double totalBill,
    double totalCommission
) {}

package com.ssdc.ssdclabs.dto;

public record AccountsDoctorDetailDTO(
    String date,
    String reportId,
    String patientName,
    String doctorName,
    double billAmount,
    double discountAmount,
    double paidAmount,
    double dueAmount,
    double commissionAmount
) {}

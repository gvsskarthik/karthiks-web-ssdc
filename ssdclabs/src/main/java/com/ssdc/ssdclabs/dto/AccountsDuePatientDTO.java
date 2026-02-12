package com.ssdc.ssdclabs.dto;

import java.time.LocalDate;

public record AccountsDuePatientDTO(
    LocalDate visitDate,
    Long patientId,
    String patientName,
    String mobile,
    String address,
    String doctorName,
    double dueAmount,
    String status
) {}

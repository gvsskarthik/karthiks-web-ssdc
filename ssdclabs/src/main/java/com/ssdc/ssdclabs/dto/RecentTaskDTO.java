package com.ssdc.ssdclabs.dto;

public record RecentTaskDTO(
    long id,
    String patientName,
    String date,
    double dueAmount,
    boolean pending
) {}


package com.ssdc.lab.dto;

public record TestResultSaveRequest(
  Long patientTestId,
  String resultValue
) {
}

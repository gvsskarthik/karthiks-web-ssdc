package com.ssdc.lab.dto;

public record TestResultSaveRequest(
  Long patientTestId,
  String parameterName,
  String unit,
  String resultValue
) {
}

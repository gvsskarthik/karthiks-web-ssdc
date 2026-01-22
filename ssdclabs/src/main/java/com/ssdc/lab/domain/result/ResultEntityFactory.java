package com.ssdc.lab.domain.result;

public final class ResultEntityFactory {
  private ResultEntityFactory() {
  }

  public static TestResultEntity createTestResult() {
    return new TestResultEntity();
  }
}

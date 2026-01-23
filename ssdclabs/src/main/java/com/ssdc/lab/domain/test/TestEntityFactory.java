package com.ssdc.lab.domain.test;

public final class TestEntityFactory {
  private TestEntityFactory() {
  }

  public static TestEntity createTest() {
    return new TestEntity();
  }

  public static TestGroupEntity createTestGroup() {
    return new TestGroupEntity();
  }

  public static GroupTestEntity createGroupTest() {
    return new GroupTestEntity();
  }

  public static TestParameterEntity createTestParameter() {
    return new TestParameterEntity();
  }

  public static TestDefaultResultEntity createTestDefaultResult() {
    return new TestDefaultResultEntity();
  }
}

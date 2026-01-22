package com.ssdc.lab.domain.patient;

public final class PatientEntityFactory {
  private PatientEntityFactory() {
  }

  public static PatientEntity createPatient() {
    return new PatientEntity();
  }

  public static PatientVisitEntity createVisit() {
    return new PatientVisitEntity();
  }

  public static PatientTestEntity createPatientTest() {
    return new PatientTestEntity();
  }
}

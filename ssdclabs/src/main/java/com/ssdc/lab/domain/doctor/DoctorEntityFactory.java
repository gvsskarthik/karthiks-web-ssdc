package com.ssdc.lab.domain.doctor;

public final class DoctorEntityFactory {
  private DoctorEntityFactory() {
  }

  public static DoctorEntity createDoctor() {
    return new DoctorEntity();
  }
}

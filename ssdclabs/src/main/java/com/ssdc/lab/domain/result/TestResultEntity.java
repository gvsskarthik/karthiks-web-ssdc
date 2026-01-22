package com.ssdc.lab.domain.result;

import com.ssdc.lab.domain.patient.PatientTestEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
  name = "test_results",
  indexes = {
    @Index(name = "idx_test_results_patient_test_id", columnList = "patient_test_id")
  }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TestResultEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "patient_test_id", nullable = false)
  private PatientTestEntity patientTest;

  @Column(name = "parameter_name", nullable = false, length = 150)
  private String parameterName;

  @Column(name = "result_value", nullable = false, length = 255)
  private String resultValue;

  @Column(name = "unit", nullable = false, length = 50)
  private String unit;
}

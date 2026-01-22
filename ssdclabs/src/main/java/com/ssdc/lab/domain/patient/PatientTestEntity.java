package com.ssdc.lab.domain.patient;

import com.ssdc.lab.domain.test.TestEntity;
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

import java.math.BigDecimal;

@Entity
@Table(
  name = "patient_tests",
  indexes = {
    @Index(name = "idx_patient_tests_visit_id", columnList = "visit_id"),
    @Index(name = "idx_patient_tests_test_id", columnList = "test_id")
  }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PatientTestEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "visit_id", nullable = false)
  private PatientVisitEntity visit;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "test_id", nullable = false)
  private TestEntity test;

  @Column(name = "price_at_time", nullable = false, precision = 10, scale = 2)
  private BigDecimal priceAtTime;
}

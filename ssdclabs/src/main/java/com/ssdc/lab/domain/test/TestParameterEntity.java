package com.ssdc.lab.domain.test;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
  name = "test_parameters",
  indexes = {
    @Index(name = "idx_test_parameters_test_id", columnList = "test_id")
  }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TestParameterEntity {
  public enum ValueType {
    NUMBER,
    TEXT
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "test_id", nullable = false)
  private TestEntity test;

  @Column(name = "parameter_name", nullable = false, length = 150)
  private String parameterName;

  @Column(name = "unit", nullable = false, length = 50)
  private String unit;

  @Enumerated(EnumType.STRING)
  @Column(name = "value_type", nullable = false)
  private ValueType valueType;

  @Column(name = "normal_min", precision = 10, scale = 2)
  private BigDecimal normalMin;

  @Column(name = "normal_max", precision = 10, scale = 2)
  private BigDecimal normalMax;
}

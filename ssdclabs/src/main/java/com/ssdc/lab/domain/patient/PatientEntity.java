package com.ssdc.lab.domain.patient;

import com.ssdc.lab.config.crypto.AesAttributeConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
  name = "patients",
  uniqueConstraints = {
    @UniqueConstraint(name = "uq_patients_patient_code", columnNames = "patient_code")
  }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PatientEntity {
  public enum Sex {
    MALE,
    FEMALE,
    OTHER
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "patient_code", nullable = false, length = 50)
  private String patientCode;

  @Convert(converter = AesAttributeConverter.class)
  @Column(name = "name", nullable = false, length = 150)
  private String name;

  @Column(name = "age", nullable = false)
  private int age;

  @Enumerated(EnumType.STRING)
  @Column(name = "sex", nullable = false)
  private Sex sex;

  @Convert(converter = AesAttributeConverter.class)
  @Column(name = "mobile", nullable = false, length = 30)
  private String mobile;

  @Convert(converter = AesAttributeConverter.class)
  @Column(name = "address", nullable = false, length = 255)
  private String address;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;
}

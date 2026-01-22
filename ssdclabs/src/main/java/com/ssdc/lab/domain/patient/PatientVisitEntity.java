package com.ssdc.lab.domain.patient;

import com.ssdc.lab.domain.doctor.DoctorEntity;
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
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
  name = "patient_visits",
  indexes = {
    @Index(name = "idx_patient_visits_patient_id", columnList = "patient_id"),
    @Index(name = "idx_patient_visits_doctor_id", columnList = "doctor_id")
  }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PatientVisitEntity {
  public enum Status {
    REGISTERED,
    IN_PROGRESS,
    COMPLETED
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "patient_id", nullable = false)
  private PatientEntity patient;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "doctor_id")
  private DoctorEntity doctor;

  @Column(name = "visit_date", nullable = false)
  private LocalDateTime visitDate;

  @Column(name = "lab_name", length = 150)
  private String labName;

  @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
  private BigDecimal discountAmount;

  @Column(name = "paid_amount", nullable = false, precision = 10, scale = 2)
  private BigDecimal paidAmount;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private Status status;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;
}

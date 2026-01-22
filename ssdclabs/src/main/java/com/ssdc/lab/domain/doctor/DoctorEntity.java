package com.ssdc.lab.domain.doctor;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "doctors")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DoctorEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "name", nullable = false, length = 150)
  private String name;

  @Column(name = "specialization", nullable = false, length = 150)
  private String specialization;

  @Column(name = "phone", nullable = false, length = 30)
  private String phone;

  @Column(name = "hospital", nullable = false, length = 150)
  private String hospital;

  @Column(name = "commission_percentage", nullable = false, precision = 5, scale = 2)
  private BigDecimal commissionPercentage;

  @Column(name = "display_name", nullable = false, length = 150)
  private String displayName;

  @Column(name = "is_active", nullable = false)
  private boolean isActive;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;
}

package com.ssdc.lab.domain.test;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
  name = "tests",
  uniqueConstraints = {
    @UniqueConstraint(name = "uq_tests_shortcut", columnNames = "shortcut")
  }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TestEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "test_name", nullable = false, length = 150)
  private String testName;

  @Column(name = "shortcut", nullable = false, length = 50)
  private String shortcut;

  @Column(name = "category", nullable = false, length = 100)
  private String category;

  @Column(name = "price", nullable = false, precision = 10, scale = 2)
  private BigDecimal price;

  @Column(name = "is_active", nullable = false)
  private boolean isActive;

  @Column(name = "has_parameters", nullable = false)
  private boolean hasParameters;

  @Column(name = "has_default_results", nullable = false)
  private boolean hasDefaultResults;

  @Column(name = "allow_multiple_results", nullable = false)
  private boolean allowMultipleResults;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;
}

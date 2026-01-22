package com.ssdc.lab.domain.test;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
  name = "group_tests",
  uniqueConstraints = {
    @UniqueConstraint(name = "uq_group_tests", columnNames = { "group_id", "test_id" })
  },
  indexes = {
    @Index(name = "idx_group_tests_group_id", columnList = "group_id"),
    @Index(name = "idx_group_tests_test_id", columnList = "test_id")
  }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GroupTestEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "group_id", nullable = false)
  private TestGroupEntity group;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "test_id", nullable = false)
  private TestEntity test;
}

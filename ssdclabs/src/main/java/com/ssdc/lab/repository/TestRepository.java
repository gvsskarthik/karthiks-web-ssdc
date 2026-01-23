package com.ssdc.lab.repository;

import com.ssdc.lab.domain.test.TestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestRepository extends JpaRepository<TestEntity, Long> {
  boolean existsByShortcutIgnoreCase(String shortcut);
  boolean existsByShortcutIgnoreCaseAndIdNot(String shortcut, Long id);
}

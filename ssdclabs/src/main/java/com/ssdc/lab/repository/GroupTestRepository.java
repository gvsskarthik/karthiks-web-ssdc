package com.ssdc.lab.repository;

import com.ssdc.lab.domain.test.GroupTestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface GroupTestRepository extends JpaRepository<GroupTestEntity, Long> {
  List<GroupTestEntity> findByGroupId(Long groupId);

  List<GroupTestEntity> findByGroupIdIn(Collection<Long> groupIds);

  void deleteByGroupId(Long groupId);
}

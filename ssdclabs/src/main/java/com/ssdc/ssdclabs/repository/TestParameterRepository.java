package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.TestParameter;

public interface TestParameterRepository
        extends JpaRepository<TestParameter, Long> {
    List<TestParameter> findByTest_IdOrderByDisplayOrderAsc(Long testId);
}

package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssdc.ssdclabs.model.TestParameter;

public interface TestParameterRepository
        extends JpaRepository<TestParameter, Long> {
    interface TestParamCount {
        Long getTestId();
        Long getParamCount();
    }

    List<TestParameter> findByTest_IdOrderByIdAsc(Long testId);

    @Query("""
        SELECT tp.test.id AS testId,
               COUNT(tp) AS paramCount
        FROM TestParameter tp
        WHERE tp.test.id IN :testIds
        GROUP BY tp.test.id
    """)
    List<TestParamCount> countByTestIds(@Param("testIds") List<Long> testIds);
}

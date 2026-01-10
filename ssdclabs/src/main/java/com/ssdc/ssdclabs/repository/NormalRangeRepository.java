package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.NormalRange;

@SuppressWarnings("unused")
public interface NormalRangeRepository
        extends JpaRepository<NormalRange, Long> {
    @SuppressWarnings("unused")
    List<NormalRange> findByParameter_Id(Long parameterId);
}

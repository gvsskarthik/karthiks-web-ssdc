package com.ssdc.ssdclabs.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssdc.ssdclabs.model.ReportObservation;

public interface ReportObservationRepository
        extends JpaRepository<ReportObservation, Long> {
    @SuppressWarnings("unused")
    List<ReportObservation> findByPatient_Id(Long patientId);

    void deleteByPatient_Id(Long patientId);

    void deleteByPatient_IdAndTest_Id(Long patientId, Long testId);
}

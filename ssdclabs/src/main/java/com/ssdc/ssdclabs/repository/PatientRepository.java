package com.ssdc.ssdclabs.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.ssdc.ssdclabs.model.Patient;

public interface PatientRepository extends JpaRepository<Patient, Long> {
    interface DoctorBillAggregate {
        Long getDoctorId();
        String getDoctorName();
        Long getPatientCount();
        Double getTotalBill();
    }

    /* Calendar date filter */
    // Ordered by most recent visit first, then newest id for stability.
    List<Patient> findByVisitDateOrderByVisitDateDescIdDesc(LocalDate visitDate);

    /* Doctor filter */
    // Ordered for reports: latest visit first, then newest id.
    List<Patient> findByDoctor_IdOrderByVisitDateDescIdDesc(Long doctorId);

    // Ordered for reports: latest visit first, then newest id.
    List<Patient> findByDoctorIsNullOrderByVisitDateDescIdDesc();

    // Ordered for consistent listings.
    List<Patient> findAllByOrderByVisitDateDescIdDesc();

    // Fetch doctor data to avoid lazy-loading issues in summaries.
    @Query("""
        SELECT p
        FROM Patient p
        LEFT JOIN FETCH p.doctor d
        ORDER BY p.visitDate DESC, p.id DESC
    """)
    List<Patient> findAllWithDoctorOrderByVisitDateDescIdDesc();

    /* 🔍 Mobile search (PARTIAL match) */
    // Ordered by most recent visit first, then newest id.
    List<Patient> findByMobileContainingOrderByVisitDateDescIdDesc(String mobile);

    /* 🔍 Name search (PARTIAL match, ignore case) */
    // Ordered by most recent visit first, then newest id.
    List<Patient> findByNameContainingIgnoreCaseOrderByVisitDateDescIdDesc(String name);

    /* 🔍 Name + mobile search (PARTIAL match) */
    // Ordered by most recent visit first, then newest id.
    List<Patient> findByNameContainingIgnoreCaseAndMobileContainingOrderByVisitDateDescIdDesc(
            String name,
            String mobile);

    // Aggregate totals ordered by highest billing first (for accounts).
    @Query("""
        SELECT d.id AS doctorId,
               COALESCE(d.name, 'SELF') AS doctorName,
               COUNT(p) AS patientCount,
               COALESCE(SUM(p.amount), 0) AS totalBill
        FROM Patient p
        LEFT JOIN p.doctor d
        GROUP BY d.id, d.name
        ORDER BY totalBill DESC
    """)
    java.util.List<DoctorBillAggregate> findDoctorBillAggregatesOrdered();
}

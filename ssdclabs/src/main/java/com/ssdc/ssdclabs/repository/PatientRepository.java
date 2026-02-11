package com.ssdc.ssdclabs.repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
    List<Patient> findByLabIdAndVisitDateOrderByVisitDateDescIdDesc(
            String labId,
            LocalDate visitDate);

    // Fetch doctor to avoid N+1 (UI lists need doctor name).
    @Query("""
        SELECT p
        FROM Patient p
        LEFT JOIN FETCH p.doctor d
        WHERE p.labId = :labId
          AND p.visitDate = :visitDate
        ORDER BY p.visitDate DESC, p.id DESC
    """)
    List<Patient> findByLabIdAndVisitDateWithDoctorOrderByVisitDateDescIdDesc(
            @Param("labId") String labId,
            @Param("visitDate") LocalDate visitDate);

    /* Doctor filter */
    // Ordered for reports: latest visit first, then newest id.
    List<Patient> findByLabIdAndDoctor_IdOrderByVisitDateDescIdDesc(
            String labId,
            Long doctorId);

    // Ordered for reports: latest visit first, then newest id.
    List<Patient> findByLabIdAndDoctorIsNullOrderByVisitDateDescIdDesc(String labId);

    // Ordered for consistent listings.
    List<Patient> findByLabIdOrderByVisitDateDescIdDesc(String labId);

    // Fetch doctor data to avoid lazy-loading issues in summaries.
    @Query("""
        SELECT p
        FROM Patient p
        LEFT JOIN FETCH p.doctor d
        WHERE p.labId = :labId
        ORDER BY p.visitDate DESC, p.id DESC
    """)
    List<Patient> findAllWithDoctorOrderByVisitDateDescIdDesc(@Param("labId") String labId);

    /* 🔍 Mobile search (PARTIAL match) */
    // Ordered by most recent visit first, then newest id.
    List<Patient> findByLabIdAndMobileContainingOrderByVisitDateDescIdDesc(
            String labId,
            String mobile);

    /* 🔍 Name search (PARTIAL match, ignore case) */
    // Ordered by most recent visit first, then newest id.
    List<Patient> findByLabIdAndNameContainingIgnoreCaseOrderByVisitDateDescIdDesc(
            String labId,
            String name);

    /* 🔍 Name + mobile search (PARTIAL match) */
    // Ordered by most recent visit first, then newest id.
    List<Patient> findByLabIdAndNameContainingIgnoreCaseAndMobileContainingOrderByVisitDateDescIdDesc(
            String labId,
            String name,
            String mobile);

    // Single search query (with optional filters) that fetches doctor to avoid N+1.
    @Query("""
        SELECT p
        FROM Patient p
        LEFT JOIN FETCH p.doctor d
        WHERE p.labId = :labId
          AND (:name = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :name, '%')))
          AND (:mobile = '' OR p.mobile LIKE CONCAT('%', :mobile, '%'))
        ORDER BY p.visitDate DESC, p.id DESC
    """)
    List<Patient> searchWithDoctorOrderByVisitDateDescIdDesc(
            @Param("labId") String labId,
            @Param("name") String name,
            @Param("mobile") String mobile);

    @Query("""
        SELECT p.id
        FROM Patient p
        WHERE p.labId = :labId
          AND (:name = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :name, '%')))
          AND (:mobile = '' OR p.mobile LIKE CONCAT('%', :mobile, '%'))
        ORDER BY p.visitDate DESC, p.id DESC
    """)
    List<Long> searchIdsOrderByVisitDateDescIdDesc(
            @Param("labId") String labId,
            @Param("name") String name,
            @Param("mobile") String mobile,
            Pageable pageable);

    @Query("""
        SELECT p
        FROM Patient p
        LEFT JOIN FETCH p.doctor d
        WHERE p.labId = :labId
          AND p.id IN :ids
    """)
    List<Patient> findByLabIdAndIdInWithDoctor(
            @Param("labId") String labId,
            @Param("ids") List<Long> ids);

    // Aggregate totals ordered by highest billing first (for accounts).
    @Query("""
        SELECT d.id AS doctorId,
               COALESCE(d.name, 'SELF') AS doctorName,
               COUNT(p) AS patientCount,
               COALESCE(SUM(p.amount), 0) AS totalBill
        FROM Patient p
        LEFT JOIN p.doctor d
        WHERE p.labId = :labId
        GROUP BY d.id, d.name
        ORDER BY totalBill DESC
    """)
    java.util.List<DoctorBillAggregate> findDoctorBillAggregatesOrdered(@Param("labId") String labId);

    long countByLabIdAndDoctor_Id(String labId, Long doctorId);

    @Query("""
        SELECT
            COALESCE(SUM(p.amount), 0),
            COALESCE(SUM(p.discount), 0),
            COALESCE(SUM(
                CASE
                    WHEN d IS NULL OR LOWER(d.name) = 'self' THEN 0
                    ELSE p.amount * (COALESCE(d.commissionRate, :defaultRate) / 100.0)
                END
            ), 0)
        FROM Patient p
        LEFT JOIN p.doctor d
        WHERE p.labId = :labId
    """)
    Object[] findAccountsSummaryNumbers(
            @Param("labId") String labId,
            @Param("defaultRate") double defaultRate
    );

    java.util.Optional<Patient> findByIdAndLabId(Long id, String labId);

    @Query("""
        SELECT p
        FROM Patient p
        WHERE p.labId = :labId
        ORDER BY p.visitDate DESC, p.id DESC
    """)
    List<Patient> findRecentPatients(
            @Param("labId") String labId,
            Pageable pageable);

    @Query(
        value = """
            SELECT
                COALESCE(SUM(CASE WHEN p.visit_date = :today THEN 1 ELSE 0 END), 0) AS todayCount,
                COALESCE(SUM(CASE WHEN p.visit_date BETWEEN :weekStart AND :today THEN 1 ELSE 0 END), 0) AS weekCount,
                COALESCE(SUM(CASE WHEN p.visit_date BETWEEN :monthStart AND :today THEN 1 ELSE 0 END), 0) AS monthCount,
                COALESCE(SUM(CASE WHEN p.visit_date BETWEEN :yearStart AND :today THEN 1 ELSE 0 END), 0) AS yearCount
            FROM patients p
            WHERE p.lab_id = :labId
        """,
        nativeQuery = true
    )
    Object[] findHomeSummaryCounts(
            @Param("labId") String labId,
            @Param("today") Date today,
            @Param("weekStart") Date weekStart,
            @Param("monthStart") Date monthStart,
            @Param("yearStart") Date yearStart
    );

    long countByLabIdAndVisitDate(String labId, LocalDate visitDate);

    @Query("""
        SELECT COUNT(p)
        FROM Patient p
        WHERE p.labId = :labId
          AND p.visitDate BETWEEN :start AND :end
    """)
    long countByLabIdAndVisitDateBetween(
            @Param("labId") String labId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    @Query("""
        SELECT COUNT(p)
        FROM Patient p
        WHERE p.labId = :labId
          AND p.visitDate = :visitDate
          AND (
            p.status IS NULL
            OR UPPER(TRIM(p.status)) <> 'COMPLETED'
          )
    """)
    long countPendingByLabIdAndVisitDate(
            @Param("labId") String labId,
            @Param("visitDate") LocalDate visitDate
    );
}

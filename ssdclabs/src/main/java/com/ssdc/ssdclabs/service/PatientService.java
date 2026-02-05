package com.ssdc.ssdclabs.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.time.ZoneId;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssdc.ssdclabs.model.Doctor;
import com.ssdc.ssdclabs.model.Gender;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.repository.DoctorRepository;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.repository.ReportResultRepository;

@Service
public class PatientService {

    public static final String STATUS_NOT_COMPLETE = "NOT COMPLETE";
    public static final String STATUS_COMPLETED = "COMPLETED";

    private final PatientRepository patientRepo;
    private final ReportResultRepository resultRepo;
    private final DoctorRepository doctorRepo;

    public PatientService(
            PatientRepository patientRepo,
            ReportResultRepository resultRepo,
            DoctorRepository doctorRepo) {
        this.patientRepo = patientRepo;
        this.resultRepo = resultRepo;
        this.doctorRepo = doctorRepo;
    }

    /* SAVE */
    public @NonNull Patient savePatient(@NonNull String labId,
                                        @NonNull Patient patient) {
        patient.setLabId(Objects.requireNonNull(labId, "labId"));
        if (patient.getVisitDate() == null) {
            patient.setVisitDate(LocalDate.now(ZoneId.of("Asia/Kolkata")));
        }
        if (patient.getStatus() == null) {
            patient.setStatus(STATUS_NOT_COMPLETE);
        }
        if (patient.getGender() == null) {
            patient.setGender(Gender.ANY);
        }

        String doctorName = patient.getDoctorName();
        Doctor doctor = resolveDoctor(labId, doctorName);
        patient.setDoctor(doctor);
        return Objects.requireNonNull(patientRepo.save(patient), "saved patient");
    }

    @Transactional
    public @NonNull Patient updateStatus(@NonNull String labId,
                                         @NonNull Long patientId,
                                         @NonNull String status) {
        String normalized = status.trim().toUpperCase();
        String finalStatus;
        if (STATUS_COMPLETED.equals(normalized)) {
            finalStatus = STATUS_COMPLETED;
        } else if (STATUS_NOT_COMPLETE.equals(normalized)) {
            finalStatus = STATUS_NOT_COMPLETE;
        } else {
            throw new IllegalArgumentException("Invalid status");
        }

        Patient patient = patientRepo.findByIdAndLabId(
            Objects.requireNonNull(patientId, "patientId"),
            Objects.requireNonNull(labId, "labId")
        ).orElseThrow(() -> new IllegalArgumentException("Patient not found"));

        patient.setStatus(finalStatus);
        return Objects.requireNonNull(patientRepo.save(patient), "saved patient");
    }

    /* FIND BY DATE */
    public List<Patient> findByDate(@NonNull String labId,
                                    @NonNull LocalDate date) {
        // Ordered for recency + stability across reloads.
        return patientRepo.findByLabIdAndVisitDateOrderByVisitDateDescIdDesc(
            Objects.requireNonNull(labId, "labId"),
            Objects.requireNonNull(date, "date"));
    }

    /* SEARCH BY NAME + MOBILE (PARTIAL) */
    public List<Patient> searchPatients(@NonNull String labId,
                                        String name,
                                        String mobile) {
        String nameQuery = name == null ? "" : name.trim();
        String mobileQuery = mobile == null ? "" : mobile.trim();

        if (nameQuery.isEmpty() && mobileQuery.isEmpty()) {
            return patientRepo.findByLabIdOrderByVisitDateDescIdDesc(labId);
        }
        if (nameQuery.isEmpty()) {
            return patientRepo.findByLabIdAndMobileContainingOrderByVisitDateDescIdDesc(
                labId,
                mobileQuery);
        }
        if (mobileQuery.isEmpty()) {
            return patientRepo.findByLabIdAndNameContainingIgnoreCaseOrderByVisitDateDescIdDesc(
                labId,
                nameQuery);
        }
        return patientRepo.findByLabIdAndNameContainingIgnoreCaseAndMobileContainingOrderByVisitDateDescIdDesc(
            labId,
            nameQuery,
            mobileQuery);
    }

    /* DELETE PATIENT + ALL RELATED DATA */
    @Transactional
    public void deletePatient(@NonNull String labId,
                              @NonNull Long patientId) {
        Patient patient = patientRepo.findByIdAndLabId(
            Objects.requireNonNull(patientId, "patientId"),
            Objects.requireNonNull(labId, "labId")
        ).orElseThrow(() -> new IllegalArgumentException("Patient not found"));

        // 1️⃣ delete report results
        resultRepo.deleteByPatient_Id(
            patient.getId());

        // 2️⃣ delete patient
        patientRepo.deleteById(
            patient.getId());
    }

    private Doctor resolveDoctor(String labId, String doctorName) {
        if (doctorName == null) {
            return null;
        }
        String trimmed = doctorName.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if ("SELF".equalsIgnoreCase(trimmed)) {
            return doctorRepo.findFirstByLabIdAndNameIgnoreCase(labId, trimmed)
                .orElseGet(() -> {
                    Doctor doctor = new Doctor();
                    doctor.setLabId(labId);
                    doctor.setName("SELF");
                    return doctorRepo.save(doctor);
                });
        }
        return doctorRepo.findFirstByLabIdAndNameIgnoreCase(labId, trimmed)
            .orElseGet(() -> {
                Doctor doctor = new Doctor();
                doctor.setLabId(labId);
                doctor.setName(trimmed);
                return doctorRepo.save(doctor);
            });
    }
}

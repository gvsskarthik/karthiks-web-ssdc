package com.ssdc.ssdclabs.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssdc.ssdclabs.model.Doctor;
import com.ssdc.ssdclabs.model.Gender;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.repository.DoctorRepository;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.repository.ReportObservationRepository;
import com.ssdc.ssdclabs.repository.ReportResultRepository;

@Service
public class PatientService {

    private final PatientRepository patientRepo;
    private final ReportResultRepository resultRepo;
    private final ReportObservationRepository observationRepo;
    private final DoctorRepository doctorRepo;

    public PatientService(
            PatientRepository patientRepo,
            ReportResultRepository resultRepo,
            ReportObservationRepository observationRepo,
            DoctorRepository doctorRepo) {
        this.patientRepo = patientRepo;
        this.resultRepo = resultRepo;
        this.observationRepo = observationRepo;
        this.doctorRepo = doctorRepo;
    }

    /* SAVE */
    public @NonNull Patient savePatient(@NonNull Patient patient) {
        if (patient.getVisitDate() == null) {
            patient.setVisitDate(LocalDate.now());
        }
        if (patient.getStatus() == null) {
            patient.setStatus("NOT COMPLETE");
        }
        if (patient.getGender() == null) {
            patient.setGender(Gender.ANY);
        }

        String doctorName = patient.getDoctorName();
        Doctor doctor = resolveDoctor(doctorName);
        patient.setDoctor(doctor);
        return Objects.requireNonNull(patientRepo.save(patient), "saved patient");
    }

    /* FIND BY DATE */
    public List<Patient> findByDate(@NonNull LocalDate date) {
        // Ordered for recency + stability across reloads.
        return patientRepo.findByVisitDateOrderByVisitDateDescIdDesc(
            Objects.requireNonNull(date, "date"));
    }

    /* SEARCH BY NAME + MOBILE (PARTIAL) */
    public List<Patient> searchPatients(String name, String mobile) {
        String nameQuery = name == null ? "" : name.trim();
        String mobileQuery = mobile == null ? "" : mobile.trim();

        if (nameQuery.isEmpty() && mobileQuery.isEmpty()) {
            return patientRepo.findAllByOrderByVisitDateDescIdDesc();
        }
        if (nameQuery.isEmpty()) {
            return patientRepo.findByMobileContainingOrderByVisitDateDescIdDesc(
                mobileQuery);
        }
        if (mobileQuery.isEmpty()) {
            return patientRepo.findByNameContainingIgnoreCaseOrderByVisitDateDescIdDesc(
                nameQuery);
        }
        return patientRepo.findByNameContainingIgnoreCaseAndMobileContainingOrderByVisitDateDescIdDesc(
            nameQuery,
            mobileQuery);
    }

    /* DELETE PATIENT + ALL RELATED DATA */
    @Transactional
    public void deletePatient(@NonNull Long patientId) {

        // 1️⃣ delete report results
        resultRepo.deleteByPatient_Id(
            Objects.requireNonNull(patientId, "patientId"));

        // 2️⃣ delete report observations
        observationRepo.deleteByPatient_Id(
            Objects.requireNonNull(patientId, "patientId"));

        // 3️⃣ delete patient
        patientRepo.deleteById(
            Objects.requireNonNull(patientId, "patientId"));
    }

    private Doctor resolveDoctor(String doctorName) {
        if (doctorName == null) {
            return null;
        }
        String trimmed = doctorName.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if ("SELF".equalsIgnoreCase(trimmed)) {
            return doctorRepo.findFirstByNameIgnoreCase(trimmed)
                .orElseGet(() -> {
                    Doctor doctor = new Doctor();
                    doctor.setName("SELF");
                    return doctorRepo.save(doctor);
                });
        }
        return doctorRepo.findFirstByNameIgnoreCase(trimmed)
            .orElseGet(() -> {
                Doctor doctor = new Doctor();
                doctor.setName(trimmed);
                return doctorRepo.save(doctor);
            });
    }
}

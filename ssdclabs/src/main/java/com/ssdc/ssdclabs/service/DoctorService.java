package com.ssdc.ssdclabs.service;

import java.util.List;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.model.Doctor;
import com.ssdc.ssdclabs.repository.DoctorRepository;
import com.ssdc.ssdclabs.repository.PatientRepository;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepo;
    private final PatientRepository patientRepo;

    public DoctorService(DoctorRepository doctorRepo, PatientRepository patientRepo) {
        this.doctorRepo = doctorRepo;
        this.patientRepo = patientRepo;
    }

    public @NonNull Doctor saveDoctor(@NonNull Doctor doctor) {
        return Objects.requireNonNull(doctorRepo.save(doctor), "saved doctor");
    }

    public List<Doctor> getAllDoctors() {
        // Ordered by name for consistent lists.
        return doctorRepo.findAllByOrderByNameAsc();
    }

    public void deleteDoctor(@NonNull Long doctorId) {
        if (patientRepo.countByDoctor_Id(doctorId) > 0) {
            throw new IllegalStateException("Doctor has assigned patients");
        }
        doctorRepo.deleteById(doctorId);
    }
}

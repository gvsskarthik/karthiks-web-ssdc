package com.ssdc.ssdclabs.service;

import java.util.List;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.model.Doctor;
import com.ssdc.ssdclabs.repository.DoctorRepository;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepo;

    public DoctorService(DoctorRepository doctorRepo) {
        this.doctorRepo = doctorRepo;
    }

    public @NonNull Doctor saveDoctor(@NonNull Doctor doctor) {
        return Objects.requireNonNull(doctorRepo.save(doctor), "saved doctor");
    }

    public List<Doctor> getAllDoctors() {
        // Ordered by name for consistent lists.
        return doctorRepo.findAllByOrderByNameAsc();
    }
}

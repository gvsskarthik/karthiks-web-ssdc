package com.ssdc.ssdclabs.service;

import com.ssdc.ssdclabs.AppConstants;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;

import org.springframework.lang.NonNull;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.ssdc.ssdclabs.dto.RecentTaskDTO;
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

    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final WhatsAppService whatsAppService;

    public PatientService(
            PatientRepository patientRepo,
            ReportResultRepository resultRepo,
            DoctorRepository doctorRepo,
            org.springframework.security.crypto.password.PasswordEncoder passwordEncoder,
            WhatsAppService whatsAppService) {
        this.patientRepo = patientRepo;
        this.resultRepo = resultRepo;
        this.doctorRepo = doctorRepo;
        this.passwordEncoder = passwordEncoder;
        this.whatsAppService = whatsAppService;
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

    @Transactional(readOnly = true)
    public @NonNull Patient getPatientById(@NonNull String labId,
                                           @NonNull Long patientId) {
        return patientRepo.findByIdAndLabIdWithDoctor(
            Objects.requireNonNull(patientId, "patientId"),
            Objects.requireNonNull(labId, "labId")
        ).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));
    }

    @Transactional
    public @NonNull Patient updatePatient(@NonNull String labId,
                                          @NonNull Long patientId,
                                          @NonNull Patient updates,
                                          String editPin) {
        Patient patient = patientRepo.findByIdAndLabId(
            Objects.requireNonNull(patientId, "patientId"),
            Objects.requireNonNull(labId, "labId")
        ).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));

        final boolean completed = STATUS_COMPLETED.equalsIgnoreCase(
            patient.getStatus() == null ? "" : patient.getStatus().trim()
        );
        if (completed && !isValidCompletedEditPin(editPin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "PIN required to edit COMPLETED patient");
        }

        String name = updates.getName();
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }
        patient.setName(name.trim());
        patient.setAge(updates.getAge());
        patient.setGender(updates.getGender() == null ? Gender.ANY : updates.getGender());

        String mobile = updates.getMobile();
        patient.setMobile(mobile == null || mobile.trim().isEmpty() ? null : mobile.trim());

        String address = updates.getAddress();
        patient.setAddress(address == null || address.trim().isEmpty() ? null : address.trim());

        Double amount = updates.getAmount();
        patient.setAmount(amount == null ? 0.0 : amount);

        Double discount = updates.getDiscount();
        patient.setDiscount(discount == null ? 0.0 : discount);

        patient.setPaid(updates.getPaid());

        if (updates.getVisitDate() != null) {
            patient.setVisitDate(updates.getVisitDate());
        }

        String doctorName = updates.getDoctorName();
        Doctor doctor = resolveDoctor(labId, doctorName);
        patient.setDoctor(doctor);

        return Objects.requireNonNull(patientRepo.save(patient), "saved patient");
    }

    @Transactional
    public @NonNull Patient updateStatus(@NonNull String labId,
                                         @NonNull Long patientId,
                                         @NonNull String status,
                                         String editPin) {
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

        final boolean currentlyCompleted = STATUS_COMPLETED.equalsIgnoreCase(
            patient.getStatus() == null ? "" : patient.getStatus().trim()
        );
        if (currentlyCompleted && !STATUS_COMPLETED.equals(finalStatus)
                && !isValidCompletedEditPin(editPin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "PIN required to reopen COMPLETED patient");
        }

        if (patient.getAppLoginId() == null) {
            final String mobile = patient.getMobile();
            final String candidate = mobile == null ? null : mobile.trim();
            if (candidate != null && !candidate.isEmpty() && !patientRepo.existsByAppLoginId(candidate)) {
                patient.setAppLoginId(candidate);
            }
        }

        if (STATUS_COMPLETED.equals(finalStatus) && !STATUS_COMPLETED.equals(patient.getStatus())) {
            // Generate a 6-digit password for the patient app login (if not already set).
            // Lab staff will manually share credentials via WhatsApp from the Reports page.
            if (patient.getPassword() == null) {
                int randomPin = 100000 + new java.security.SecureRandom().nextInt(900000);
                String clearPassword = String.valueOf(randomPin);
                patient.setPassword(passwordEncoder.encode(clearPassword));
            }
        }

        patient.setStatus(finalStatus);
        return Objects.requireNonNull(patientRepo.save(patient), "saved patient");
    }

    /* FIND BY DATE */
    public List<Patient> findByDate(@NonNull String labId,
                                    @NonNull LocalDate date) {
        // Ordered for recency + stability across reloads.
        return patientRepo.findByLabIdAndVisitDateWithDoctorOrderByVisitDateDescIdDesc(
            Objects.requireNonNull(labId, "labId"),
            Objects.requireNonNull(date, "date"));
    }

    /* SEARCH BY NAME + MOBILE (PARTIAL) */
    public List<Patient> searchPatients(@NonNull String labId,
                                        String name,
                                        String mobile) {
        return searchPatientsPaged(labId, name, mobile, 0, 50);
    }

    public List<Patient> searchPatientsPaged(@NonNull String labId,
                                            String name,
                                            String mobile,
                                            int page,
                                            int limit) {
        final String safeLabId = Objects.requireNonNull(labId, "labId");
        final String nameQuery = name == null ? "" : name.trim();
        final String mobileQuery = mobile == null ? "" : mobile.trim();

        final int safePage = Math.max(0, page);
        final int safeLimit = Math.max(1, Math.min(200, limit));

        final List<Long> ids = patientRepo.searchIdsOrderByVisitDateDescIdDesc(
            safeLabId,
            nameQuery,
            mobileQuery,
            PageRequest.of(safePage, safeLimit)
        );
        if (ids.isEmpty()) {
            return List.of();
        }

        // Fetch with doctor (avoid N+1), then re-apply the desired order.
        final List<Patient> rows = patientRepo.findByLabIdAndIdInWithDoctor(safeLabId, ids);

        final Map<Long, Integer> order = new HashMap<>(ids.size() * 2);
        for (int i = 0; i < ids.size(); i++) {
            order.put(ids.get(i), i);
        }

        rows.sort(Comparator.comparingInt((Patient p) -> {
            if (p == null || p.getId() == null) {
                return Integer.MAX_VALUE;
            }
            return order.getOrDefault(p.getId(), Integer.MAX_VALUE);
        }));

        return rows;
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

    public List<RecentTaskDTO> getRecentTasks(@NonNull String labId, int limit) {
        final int safeLimit = Math.max(1, Math.min(100, limit));

        // Fetch a small recent window using the (lab_id, visit_date) index, then filter in-memory.
        // This avoids expensive DB-side filtering on status/amount/paid.
        final int candidateSize = Math.max(200, safeLimit * 25);

        final LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        final LocalDate yesterday = today.minusDays(1);

        final List<Patient> candidates = patientRepo.findRecentPatients(
            Objects.requireNonNull(labId, "labId"),
            PageRequest.of(0, candidateSize)
        );

        record Row(RecentTaskDTO dto, LocalDate date, int group, int sub) {}
        final ArrayList<Row> rows = new ArrayList<>();

        for (Patient p : candidates) {
            if (p == null || p.getVisitDate() == null) {
                continue;
            }

            final boolean pending = !STATUS_COMPLETED.equalsIgnoreCase(
                p.getStatus() == null ? "" : p.getStatus().trim()
            );
            final double amount = p.getAmount() == null ? 0.0 : p.getAmount();
            final double paid = p.getPaid();
            final double due = Math.max(0.0, amount - paid);

            // Only include rows that have any task signal (pending or unpaid).
            if (!pending && due <= 0.0) {
                continue;
            }

            final LocalDate date = p.getVisitDate();
            final int group = sortGroup(date, pending, due, today, yesterday);
            final int sub = sortSubGroup(date, pending, due, today, yesterday);

            rows.add(new Row(
                new RecentTaskDTO(
                    p.getId() == null ? 0L : p.getId(),
                    p.getName(),
                    date.toString(),
                    due,
                    pending
                ),
                date,
                group,
                sub
            ));
        }

        rows.sort(Comparator
            .comparingInt(Row::group)
            .thenComparing((Row a, Row b) -> {
                // Past days: newer date first.
                if (a.group() == 4 && b.group() == 4) {
                    return b.date().compareTo(a.date());
                }
                return 0;
            })
            .thenComparingInt(Row::sub)
            .thenComparing(Comparator.comparingLong((Row r) -> r.dto().id()).reversed())
        );

        if (rows.size() <= safeLimit) {
            return rows.stream().map(Row::dto).toList();
        }
        return rows.subList(0, safeLimit).stream().map(Row::dto).toList();
    }

    private static int sortGroup(LocalDate date, boolean pending, double due, LocalDate today, LocalDate yesterday) {
        if (date == null) {
            return 5;
        }
        final boolean dueOnly = due > 0.0 && !pending;
        if (date.equals(today)) {
            // Priority: today's pending, then today's due-only.
            return pending ? 1 : (dueOnly ? 2 : 4);
        }
        if (date.equals(yesterday)) {
            return 3; // yesterday pending/due
        }
        return 4; // past days
    }

    private static int sortSubGroup(LocalDate date, boolean pending, double due, LocalDate today, LocalDate yesterday) {
        if (date == null) {
            return 9;
        }
        final boolean dueOnly = due > 0.0 && !pending;
        if (date.equals(today)) {
            return 0;
        }
        if (date.equals(yesterday)) {
            // yesterday: pending first, then due-only
            return pending ? 0 : (dueOnly ? 1 : 2);
        }
        // past: pending first, then due-only
        return pending ? 0 : (dueOnly ? 1 : 2);
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

    private static boolean isValidCompletedEditPin(String editPin) {
        return AppConstants.isValidCompletedEditPin(editPin);
    }
}

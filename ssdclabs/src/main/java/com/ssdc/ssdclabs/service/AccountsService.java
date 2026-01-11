package com.ssdc.ssdclabs.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.dto.AccountsDoctorDTO;
import com.ssdc.ssdclabs.dto.AccountsDoctorDetailDTO;
import com.ssdc.ssdclabs.dto.AccountsSummaryDTO;
import com.ssdc.ssdclabs.model.Doctor;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.repository.DoctorRepository;
import com.ssdc.ssdclabs.repository.PatientRepository;

@Service
public class AccountsService {

    private final PatientRepository patientRepo;
    private final DoctorRepository doctorRepo;
    private final double defaultCommissionRate;

    public AccountsService(
            PatientRepository patientRepo,
            DoctorRepository doctorRepo,
            @Value("${accounts.default-commission-rate:0}") double defaultCommissionRate) {
        this.patientRepo = Objects.requireNonNull(patientRepo, "patientRepo");
        this.doctorRepo = Objects.requireNonNull(doctorRepo, "doctorRepo");
        this.defaultCommissionRate = defaultCommissionRate;
    }

    public @NonNull AccountsSummaryDTO getSummary() {
        List<Patient> patients = patientRepo.findAllWithDoctorOrderByVisitDateDescIdDesc();

        double totalRevenue = patients.stream()
            .mapToDouble(this::safeAmount)
            .sum();

        double totalCommission = patients.stream()
            .mapToDouble(p -> {
                String doctorName = resolveDoctorName(p);
                return calculateCommission(
                    safeAmount(p),
                    commissionRateFor(p.getDoctor(), doctorName)
                );
            })
            .sum();

        double netProfit = totalRevenue - totalCommission;

        return new AccountsSummaryDTO(totalRevenue, totalCommission, netProfit);
    }

    public @NonNull List<AccountsDoctorDTO> getDoctorSummaries() {
        // Aggregated totals are ordered by totalBill DESC in the query.
        List<PatientRepository.DoctorBillAggregate> aggregates =
            patientRepo.findDoctorBillAggregatesOrdered();

        List<Doctor> doctors = doctorRepo.findAllByOrderByNameAsc();
        Map<Long, Doctor> doctorById = new HashMap<>();
        for (Doctor doctor : doctors) {
            if (doctor.getId() != null) {
                doctorById.put(doctor.getId(), doctor);
            }
        }
        List<AccountsDoctorDTO> summaries = new ArrayList<>();
        Set<String> addedNames = new HashSet<>();

        for (PatientRepository.DoctorBillAggregate agg : aggregates) {
            Long docId = agg.getDoctorId();
            String name = normalizeDoctorName(agg.getDoctorName());
            String doctorId = docId == null ? "SELF" : String.valueOf(docId);
            Doctor doctor = docId == null ? null : doctorById.get(docId);
            double rate = commissionRateFor(doctor, name);
            long patientCount =
                agg.getPatientCount() == null ? 0 : agg.getPatientCount();
            double totalBill =
                agg.getTotalBill() == null ? 0 : agg.getTotalBill();
            summaries.add(new AccountsDoctorDTO(
                doctorId,
                name,
                rate,
                patientCount,
                totalBill,
                calculateCommission(totalBill, rate)
            ));
            addedNames.add(doctorId);
        }

        // Append doctors without patients (zero totals) after ordered results.
        for (Doctor doc : doctors) {
            String name = normalizeDoctorName(doc.getName());
            String doctorId = doc.getId() == null ? "" : String.valueOf(doc.getId());
            if (addedNames.contains(doctorId)) {
                continue;
            }
            double rate = commissionRateFor(doc, name);
            summaries.add(new AccountsDoctorDTO(
                doctorId,
                name,
                rate,
                0,
                0,
                0
            ));
        }

        return summaries;
    }

    public @NonNull List<AccountsDoctorDetailDTO> getDoctorDetails(
            @NonNull String doctorId) {
        DoctorSelection selection = resolveDoctorSelection(doctorId);
        if (selection == null) {
            return new ArrayList<>();
        }

        Doctor doctor = selection.id() == null
            ? null
            : doctorRepo.findById(selection.id()).orElse(null);
        double rate = commissionRateFor(doctor, selection.name());
        // Ordered by report date desc, then report id desc.
        List<Patient> patients = selection.id() == null
            ? patientRepo.findByDoctorIsNullOrderByVisitDateDescIdDesc()
            : patientRepo.findByDoctor_IdOrderByVisitDateDescIdDesc(
                selection.id());

        List<AccountsDoctorDetailDTO> details = new ArrayList<>();
        for (Patient patient : patients) {
            double bill = safeAmount(patient);
            double commission = calculateCommission(bill, rate);
            String date = patient.getVisitDate() == null
                ? ""
                : patient.getVisitDate().toString();
            String reportId = patient.getId() == null
                ? ""
                : "R" + patient.getId();
            String doctorName = normalizeDoctorName(resolveDoctorName(patient));
            details.add(new AccountsDoctorDetailDTO(
                date,
                reportId,
                patient.getName(),
                doctorName,
                bill,
                commission
            ));
        }

        return details;
    }

    public @NonNull List<AccountsDoctorDetailDTO> getAllDetails() {
        List<Patient> patients = patientRepo.findAllWithDoctorOrderByVisitDateDescIdDesc();
        List<AccountsDoctorDetailDTO> details = new ArrayList<>();

        for (Patient patient : patients) {
            double bill = safeAmount(patient);
            String doctorName = resolveDoctorName(patient);
            double rate = commissionRateFor(patient.getDoctor(), doctorName);
            double commission = calculateCommission(bill, rate);
            String date = patient.getVisitDate() == null
                ? ""
                : patient.getVisitDate().toString();
            String reportId = patient.getId() == null
                ? ""
                : "R" + patient.getId();
            details.add(new AccountsDoctorDetailDTO(
                date,
                reportId,
                patient.getName(),
                normalizeDoctorName(doctorName),
                bill,
                commission
            ));
        }

        return details;
    }


    private String normalizeDoctorName(String doctorName) {
        if (doctorName == null) {
            return "SELF";
        }
        String trimmed = doctorName.trim();
        return trimmed.isEmpty() ? "SELF" : trimmed;
    }

    private boolean isSelfDoctor(String doctorName) {
        return "SELF".equalsIgnoreCase(doctorName);
    }

    private double commissionRateFor(Doctor doctor, String doctorName) {
        String normalized = normalizeDoctorName(doctorName);
        if (isSelfDoctor(normalized)) {
            return 0;
        }
        if (doctor != null && doctor.getCommissionRate() != null) {
            return doctor.getCommissionRate();
        }
        return defaultCommissionRate;
    }

    private double calculateCommission(double bill, double rate) {
        return bill * (rate / 100.0);
    }

    private double safeAmount(Patient patient) {
        if (patient == null) {
            return 0;
        }
        Double amount = patient.getAmount();
        return amount == null ? 0 : amount;
    }

    private Long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String resolveDoctorName(Patient patient) {
        if (patient == null || patient.getDoctor() == null) {
            return "SELF";
        }
        String name = patient.getDoctor().getName();
        return name == null || name.trim().isEmpty() ? "SELF" : name.trim();
    }

    private DoctorSelection resolveDoctorSelection(String doctorId) {
        if (doctorId == null) {
            return null;
        }
        String trimmed = doctorId.trim();
        if (trimmed.isEmpty() || isSelfDoctor(trimmed)) {
            return new DoctorSelection(null, "SELF");
        }
        Long numericId = parseLong(trimmed);
        if (numericId != null) {
            String name = doctorRepo.findById(numericId)
                .map(d -> normalizeDoctorName(d.getName()))
                .orElse(trimmed);
            return new DoctorSelection(numericId, name);
        }
        return doctorRepo.findFirstByNameIgnoreCase(trimmed)
            .map(d -> new DoctorSelection(d.getId(), normalizeDoctorName(d.getName())))
            .orElse(new DoctorSelection(null, trimmed));
    }

    private record DoctorSelection(Long id, String name) {}
}

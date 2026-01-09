package com.ssdc.ssdclabs.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
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
        List<Patient> patients = patientRepo.findAllByOrderByVisitDateDescIdDesc();

        double totalRevenue = patients.stream()
            .mapToDouble(Patient::getAmount)
            .sum();

        double totalCommission = patients.stream()
            .mapToDouble(p -> {
                String doctorName = normalizeDoctorName(resolveDoctorName(p));
                return calculateCommission(p.getAmount(), commissionRateFor(doctorName));
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
        List<AccountsDoctorDTO> summaries = new ArrayList<>();
        Set<String> addedNames = new HashSet<>();

        for (PatientRepository.DoctorBillAggregate agg : aggregates) {
            Long docId = agg.getDoctorId();
            String name = normalizeDoctorName(agg.getDoctorName());
            String doctorId = docId == null ? "SELF" : String.valueOf(docId);
            double rate = commissionRateFor(name);
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
            double rate = commissionRateFor(name);
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

        double rate = commissionRateFor(selection.name());
        // Ordered by report date desc, then report id desc.
        List<Patient> patients = selection.id() == null
            ? patientRepo.findByDoctorIsNullOrderByVisitDateDescIdDesc()
            : patientRepo.findByDoctor_IdOrderByVisitDateDescIdDesc(
                selection.id());

        List<AccountsDoctorDetailDTO> details = new ArrayList<>();
        for (Patient patient : patients) {
            double bill = patient.getAmount();
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

    private double commissionRateFor(String doctorName) {
        if (isSelfDoctor(doctorName)) {
            return 0;
        }
        return defaultCommissionRate;
    }

    private double calculateCommission(double bill, double rate) {
        return bill * (rate / 100.0);
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

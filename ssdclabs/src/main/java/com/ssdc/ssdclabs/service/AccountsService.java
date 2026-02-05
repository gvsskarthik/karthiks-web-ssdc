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

    public @NonNull AccountsSummaryDTO getSummary(@NonNull String labId) {
        Object[] row = patientRepo.findAccountsSummaryNumbers(
            Objects.requireNonNull(labId, "labId"),
            defaultCommissionRate
        );

        double totalRevenue = toDouble(row, 0);
        double totalDiscount = toDouble(row, 1);
        double totalCommission = toDouble(row, 2);
        // totalRevenue is SUM(p.amount) (final payable), which already reflects discounts.
        // Do not subtract discount again.
        double netProfit = totalRevenue - totalCommission;

        return new AccountsSummaryDTO(totalRevenue, totalDiscount, totalCommission, netProfit);
    }

    public @NonNull List<AccountsDoctorDTO> getDoctorSummaries(@NonNull String labId) {
        // Aggregated totals are ordered by totalBill DESC in the query.
        List<PatientRepository.DoctorBillAggregate> aggregates =
            patientRepo.findDoctorBillAggregatesOrdered(
                Objects.requireNonNull(labId, "labId"));

        List<Doctor> doctors = doctorRepo.findByLabIdOrderByNameAsc(labId);
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
            @NonNull String labId,
            @NonNull String doctorId) {
        DoctorSelection selection = resolveDoctorSelection(labId, doctorId);
        if (selection == null) {
            return new ArrayList<>();
        }

        Doctor doctor = selection.id() == null
            ? null
            : doctorRepo.findByIdAndLabId(selection.id(), labId).orElse(null);
        double rate = commissionRateFor(doctor, selection.name());
        // Ordered by report date desc, then report id desc.
        List<Patient> patients = selection.id() == null
            ? patientRepo.findByLabIdAndDoctorIsNullOrderByVisitDateDescIdDesc(labId)
            : patientRepo.findByLabIdAndDoctor_IdOrderByVisitDateDescIdDesc(
                labId,
                selection.id());

        List<AccountsDoctorDetailDTO> details = new ArrayList<>();
        for (Patient patient : patients) {
            double bill = safeAmount(patient);
            double discount = safeDiscount(patient);
            double paid = safePaid(patient, bill);
            double due = Math.max(0, bill - paid);
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
                discount,
                paid,
                due,
                commission
            ));
        }

        return details;
    }

    public @NonNull List<AccountsDoctorDetailDTO> getAllDetails(@NonNull String labId) {
        List<Patient> patients = patientRepo.findAllWithDoctorOrderByVisitDateDescIdDesc(
            Objects.requireNonNull(labId, "labId")
        );
        List<AccountsDoctorDetailDTO> details = new ArrayList<>();

        for (Patient patient : patients) {
            double bill = safeAmount(patient);
            double discount = safeDiscount(patient);
            double paid = safePaid(patient, bill);
            double due = Math.max(0, bill - paid);
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
                discount,
                paid,
                due,
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

    private double safeDiscount(Patient patient) {
        if (patient == null) {
            return 0;
        }
        Double discount = patient.getDiscount();
        if (discount == null) {
            return 0;
        }
        return Math.max(0, discount);
    }

    private double safePaid(Patient patient, double bill) {
        if (patient == null) {
            return 0;
        }
        Double paid = patient.getPaid();
        double value = paid == null ? 0 : paid;
        if (value < 0) {
            value = 0;
        }
        if (bill < 0) {
            return value;
        }
        return Math.min(value, bill);
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

    private DoctorSelection resolveDoctorSelection(String labId, String doctorId) {
        if (doctorId == null) {
            return null;
        }
        String trimmed = doctorId.trim();
        if (trimmed.isEmpty() || isSelfDoctor(trimmed)) {
            return new DoctorSelection(null, "SELF");
        }
        Long numericId = parseLong(trimmed);
        if (numericId != null) {
            String name = doctorRepo.findByIdAndLabId(numericId, labId)
                .map(d -> normalizeDoctorName(d.getName()))
                .orElse(trimmed);
            return new DoctorSelection(numericId, name);
        }
        return doctorRepo.findFirstByLabIdAndNameIgnoreCase(labId, trimmed)
            .map(d -> new DoctorSelection(d.getId(), normalizeDoctorName(d.getName())))
            .orElse(new DoctorSelection(null, trimmed));
    }

    private record DoctorSelection(Long id, String name) {}

    private double toDouble(Object[] row, int idx) {
        if (row == null || idx < 0 || idx >= row.length || row[idx] == null) {
            return 0;
        }
        Object value = row[idx];
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (Exception ex) {
            return 0;
        }
    }
}

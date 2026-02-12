package com.ssdc.ssdclabs.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.AbstractPageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.dto.AccountsDuePatientDTO;
import com.ssdc.ssdclabs.dto.AccountsDoctorDTO;
import com.ssdc.ssdclabs.dto.AccountsDoctorDetailDTO;
import com.ssdc.ssdclabs.dto.AccountsSummaryDTO;
import com.ssdc.ssdclabs.model.Doctor;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.repository.DoctorRepository;
import com.ssdc.ssdclabs.repository.PatientRepository;

@Service
public class AccountsService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

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

    public @NonNull List<AccountsDoctorDetailDTO> getDetailsFiltered(
            @NonNull String labId,
            String from,
            String to,
            String doctorId) {
        final String safeLabId = Objects.requireNonNull(labId, "labId");
        final DateRange range = resolveDateRange(from, to);

        final DoctorFilter selection = resolveDoctorFilter(safeLabId, doctorId);

        final List<Patient> patients;
        if (selection.type == DoctorFilterType.ALL) {
            patients = patientRepo.findAllWithDoctorByLabIdAndVisitDateBetweenOrderByVisitDateDescIdDesc(
                safeLabId,
                range.from(),
                range.to()
            );
        } else if (selection.type == DoctorFilterType.SELF) {
            patients = patientRepo.findAllWithDoctorSelfByLabIdAndVisitDateBetweenOrderByVisitDateDescIdDesc(
                safeLabId,
                range.from(),
                range.to()
            );
        } else if (selection.doctorId != null) {
            patients = patientRepo.findAllWithDoctorByLabIdAndDoctorIdAndVisitDateBetweenOrderByVisitDateDescIdDesc(
                safeLabId,
                selection.doctorId,
                range.from(),
                range.to()
            );
        } else {
            patients = new ArrayList<>();
        }

        final List<AccountsDoctorDetailDTO> details = new ArrayList<>();
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

    public @NonNull List<AccountsDuePatientDTO> getDuePatients(
            @NonNull String labId,
            String from,
            String to,
            String doctorId,
            int limit,
            int offset) {
        final String safeLabId = Objects.requireNonNull(labId, "labId");

        final int safeLimit = clamp(limit, 1, 5000, 2000);
        final int safeOffset = Math.max(0, offset);
        final Pageable pageable = new OffsetBasedPageRequest(safeOffset, safeLimit);

        final DateRange range = resolveDateRange(from, to);

        if (doctorId == null || doctorId.trim().isEmpty()) {
            return patientRepo.findDuePatients(safeLabId, range.from(), range.to(), pageable);
        }

        final String trimmedDoctorId = doctorId.trim();
        if (isSelfDoctor(trimmedDoctorId)) {
            return patientRepo.findDuePatientsSelf(safeLabId, range.from(), range.to(), pageable);
        }

        final Long numericDoctorId = parseLong(trimmedDoctorId);
        if (numericDoctorId != null) {
            return patientRepo.findDuePatientsByDoctorId(
                safeLabId,
                numericDoctorId,
                range.from(),
                range.to(),
                pageable
            );
        }

        // Fallback: accept doctorName for convenience.
        final Long resolvedByName = doctorRepo.findFirstByLabIdAndNameIgnoreCase(safeLabId, trimmedDoctorId)
            .map(Doctor::getId)
            .orElse(null);
        if (resolvedByName == null) {
            return new ArrayList<>();
        }
        return patientRepo.findDuePatientsByDoctorId(
            safeLabId,
            resolvedByName,
            range.from(),
            range.to(),
            pageable
        );
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

    private static int clamp(int value, int min, int max, int defaultValue) {
        if (value <= 0) {
            return defaultValue;
        }
        return Math.max(min, Math.min(max, value));
    }

    private DateRange resolveDateRange(String from, String to) {
        LocalDate parsedFrom = parseDate(from);
        LocalDate parsedTo = parseDate(to);

        if (parsedFrom == null && parsedTo == null) {
            LocalDate today = LocalDate.now(IST);
            LocalDate start = today.withDayOfMonth(1);
            LocalDate end = today.with(TemporalAdjusters.lastDayOfMonth());
            return new DateRange(start, end);
        }

        if (parsedFrom == null) {
            LocalDate start = parsedTo.withDayOfMonth(1);
            return new DateRange(start, parsedTo);
        }

        if (parsedTo == null) {
            LocalDate end = parsedFrom.with(TemporalAdjusters.lastDayOfMonth());
            return new DateRange(parsedFrom, end);
        }

        if (parsedFrom.isAfter(parsedTo)) {
            throw new IllegalArgumentException("from must be before to");
        }

        return new DateRange(parsedFrom, parsedTo);
    }

    private LocalDate parseDate(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(trimmed);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid date. Use YYYY-MM-DD");
        }
    }

    private record DateRange(LocalDate from, LocalDate to) {}

    private enum DoctorFilterType { ALL, SELF, ID, INVALID }

    private static final class DoctorFilter {
        final DoctorFilterType type;
        final Long doctorId;

        DoctorFilter(DoctorFilterType type, Long doctorId) {
            this.type = type;
            this.doctorId = doctorId;
        }
    }

    private DoctorFilter resolveDoctorFilter(String labId, String doctorId) {
        if (doctorId == null) {
            return new DoctorFilter(DoctorFilterType.ALL, null);
        }
        final String trimmed = doctorId.trim();
        if (trimmed.isEmpty()) {
            return new DoctorFilter(DoctorFilterType.ALL, null);
        }
        if (isSelfDoctor(trimmed)) {
            return new DoctorFilter(DoctorFilterType.SELF, null);
        }
        final Long numeric = parseLong(trimmed);
        if (numeric != null) {
            return new DoctorFilter(DoctorFilterType.ID, numeric);
        }
        final Long resolved = doctorRepo.findFirstByLabIdAndNameIgnoreCase(labId, trimmed)
            .map(Doctor::getId)
            .orElse(null);
        if (resolved == null) {
            return new DoctorFilter(DoctorFilterType.INVALID, null);
        }
        return new DoctorFilter(DoctorFilterType.ID, resolved);
    }

    private static final class OffsetBasedPageRequest extends AbstractPageRequest {
        private final long offset;

        OffsetBasedPageRequest(long offset, int limit) {
            super(0, limit);
            this.offset = Math.max(0, offset);
        }

        @Override
        public long getOffset() {
            return offset;
        }

        @Override
        public Sort getSort() {
            return Sort.unsorted();
        }

        @Override
        public Pageable next() {
            return new OffsetBasedPageRequest(getOffset() + getPageSize(), getPageSize());
        }

        @Override
        public Pageable previous() {
            long newOffset = Math.max(0, getOffset() - getPageSize());
            return new OffsetBasedPageRequest(newOffset, getPageSize());
        }

        @Override
        public Pageable first() {
            return new OffsetBasedPageRequest(0, getPageSize());
        }

        @Override
        public Pageable withPage(int pageNumber) {
            if (pageNumber < 0) {
                return first();
            }
            return new OffsetBasedPageRequest((long) pageNumber * getPageSize(), getPageSize());
        }
    }
}

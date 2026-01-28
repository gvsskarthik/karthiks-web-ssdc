package com.ssdc.ssdclabs.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssdc.ssdclabs.dto.DashboardStatsDTO;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.repository.ReportResultRepository;

@Service
public class DashboardService {

    private final PatientRepository patientRepo;
    private final ReportResultRepository resultRepo;

    public DashboardService(PatientRepository patientRepo,
                            ReportResultRepository resultRepo) {
        this.patientRepo = patientRepo;
        this.resultRepo = resultRepo;
    }

    @Transactional(readOnly = true)
    public DashboardStatsDTO getStats() {
        LocalDate today = LocalDate.now();

        LocalDate weekStart =
            today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate yearStart = today.withDayOfYear(1);

        long todayTests = countRegisteredTests(today, today);
        long weekTests = countRegisteredTests(weekStart, today);
        long monthTests = countRegisteredTests(monthStart, today);
        long yearTests = countRegisteredTests(yearStart, today);

        long pendingPatients = patientRepo.countByStatusIgnoreCase("NOT COMPLETE");
        long completedPatients = patientRepo.countByStatusIgnoreCase("COMPLETE");

        return new DashboardStatsDTO(
            todayTests,
            weekTests,
            monthTests,
            yearTests,
            pendingPatients,
            completedPatients
        );
    }

    private long countRegisteredTests(LocalDate start, LocalDate end) {
        List<ReportResultRepository.PatientTestPair> pairs =
            resultRepo.findPatientTestPairsByVisitDateBetween(start, end);
        if (pairs == null || pairs.isEmpty()) {
            return 0;
        }
        Set<String> unique = new HashSet<>();
        for (ReportResultRepository.PatientTestPair pair : pairs) {
            if (pair == null || pair.getPatientId() == null || pair.getTestId() == null) {
                continue;
            }
            unique.add(pair.getPatientId() + ":" + pair.getTestId());
        }
        return unique.size();
    }
}


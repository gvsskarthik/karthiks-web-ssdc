package com.ssdc.ssdclabs.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.ssdc.ssdclabs.dto.HomeSummaryDTO;
import com.ssdc.ssdclabs.dto.RecentTaskDTO;
import com.ssdc.ssdclabs.repository.PatientRepository;

@Service
public class DashboardService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final PatientRepository patientRepo;
    private final PatientService patientService;

    public DashboardService(PatientRepository patientRepo, PatientService patientService) {
        this.patientRepo = patientRepo;
        this.patientService = patientService;
    }

    public @NonNull HomeSummaryDTO homeSummary(@NonNull String labId, int recentLimit) {
        final String safeLabId = Objects.requireNonNull(labId, "labId");
        final int safeLimit = Math.max(1, Math.min(100, recentLimit));

        final LocalDate today = LocalDate.now(IST);
        final LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        final LocalDate monthStart = today.withDayOfMonth(1);
        final LocalDate yearStart = today.withDayOfYear(1);

        final long todayCount = patientRepo.countByLabIdAndVisitDate(safeLabId, today);
        final long weekCount = patientRepo.countByLabIdAndVisitDateBetween(safeLabId, weekStart, today);
        final long monthCount = patientRepo.countByLabIdAndVisitDateBetween(safeLabId, monthStart, today);
        final long yearCount = patientRepo.countByLabIdAndVisitDateBetween(safeLabId, yearStart, today);

        final List<RecentTaskDTO> recent = patientService.getRecentTasks(safeLabId, safeLimit);

        return new HomeSummaryDTO(
            todayCount,
            weekCount,
            monthCount,
            yearCount,
            recent
        );
    }
}

package com.ssdc.ssdclabs.service;

import java.sql.Date;
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

        final Object[] counts = patientRepo.findHomeSummaryCounts(
            safeLabId,
            Date.valueOf(today),
            Date.valueOf(weekStart),
            Date.valueOf(monthStart),
            Date.valueOf(yearStart)
        );

        final long todayCount = toLong(counts, 0);
        final long todayPendingCount = toLong(counts, 1);
        final long weekCount = toLong(counts, 2);
        final long monthCount = toLong(counts, 3);
        final long yearCount = toLong(counts, 4);

        final List<RecentTaskDTO> recent = patientService.getRecentTasks(safeLabId, safeLimit);

        return new HomeSummaryDTO(
            todayCount,
            todayPendingCount,
            weekCount,
            monthCount,
            yearCount,
            recent
        );
    }

    private static long toLong(Object[] row, int index) {
        if (row == null || row.length == 0) return 0;
        Object val = (row[0] instanceof Object[]) ? ((Object[]) row[0])[index] : row[index];
        if (val instanceof Number) return ((Number) val).longValue();
        return 0;
    }
}

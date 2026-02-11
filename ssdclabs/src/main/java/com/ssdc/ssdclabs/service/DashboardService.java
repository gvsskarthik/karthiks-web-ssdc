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

        final Object[] counts = patientRepo.findHomeSummaryCounts(
            safeLabId,
            today,
            weekStart,
            monthStart,
            yearStart
        );

        final long todayCount = toLong(counts, 0);
        final long weekCount = toLong(counts, 1);
        final long monthCount = toLong(counts, 2);
        final long yearCount = toLong(counts, 3);

        final List<RecentTaskDTO> recent = patientService.getRecentTasks(safeLabId, safeLimit);

        return new HomeSummaryDTO(
            todayCount,
            weekCount,
            monthCount,
            yearCount,
            recent
        );
    }

    private static long toLong(Object[] arr, int idx) {
        if (arr == null || idx < 0 || idx >= arr.length) {
            return 0L;
        }
        Object v = arr[idx];
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return v == null ? 0L : Long.parseLong(String.valueOf(v));
        } catch (Exception ex) {
            return 0L;
        }
    }
}


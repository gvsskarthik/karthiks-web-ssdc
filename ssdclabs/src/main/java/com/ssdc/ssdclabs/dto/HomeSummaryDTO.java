package com.ssdc.ssdclabs.dto;

import java.util.List;

public record HomeSummaryDTO(
    long todayCount,
    long weekCount,
    long monthCount,
    long yearCount,
    List<RecentTaskDTO> recentTasks
) {}


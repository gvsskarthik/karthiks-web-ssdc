package com.ssdc.ssdclabs.dto;

public class DashboardStatsDTO {
    public long todayTests;
    public long weekTests;
    public long monthTests;
    public long yearTests;
    public long pendingPatients;
    public long completedPatients;

    @SuppressWarnings("unused")
    public DashboardStatsDTO() {}

    public DashboardStatsDTO(long todayTests,
                             long weekTests,
                             long monthTests,
                             long yearTests,
                             long pendingPatients,
                             long completedPatients) {
        this.todayTests = todayTests;
        this.weekTests = weekTests;
        this.monthTests = monthTests;
        this.yearTests = yearTests;
        this.pendingPatients = pendingPatients;
        this.completedPatients = completedPatients;
    }
}

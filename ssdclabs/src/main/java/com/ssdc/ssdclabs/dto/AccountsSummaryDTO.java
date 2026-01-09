package com.ssdc.ssdclabs.dto;

public class AccountsSummaryDTO {

    private double totalRevenue;
    private double totalCommission;
    private double netProfit;

    public AccountsSummaryDTO(double totalRevenue,
                              double totalCommission,
                              double netProfit) {
        this.totalRevenue = totalRevenue;
        this.totalCommission = totalCommission;
        this.netProfit = netProfit;
    }

    public double getTotalRevenue() {
        return totalRevenue;
    }

    public double getTotalCommission() {
        return totalCommission;
    }

    public double getNetProfit() {
        return netProfit;
    }
}

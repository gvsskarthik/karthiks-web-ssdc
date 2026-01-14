package com.ssdc.ssdclabs.dto;

public record AccountsSummaryDTO(
    double totalRevenue,
    double totalDiscount,
    double totalCommission,
    double netProfit
) {}

package com.ssdc.ssdclabs.dto;

public class AccountsDoctorDetailDTO {

    private String date;
    private String reportId;
    private String patientName;
    private double billAmount;
    private double commissionAmount;

    public AccountsDoctorDetailDTO(String date,
                                   String reportId,
                                   String patientName,
                                   double billAmount,
                                   double commissionAmount) {
        this.date = date;
        this.reportId = reportId;
        this.patientName = patientName;
        this.billAmount = billAmount;
        this.commissionAmount = commissionAmount;
    }

    public String getDate() {
        return date;
    }

    public String getReportId() {
        return reportId;
    }

    public String getPatientName() {
        return patientName;
    }

    public double getBillAmount() {
        return billAmount;
    }

    public double getCommissionAmount() {
        return commissionAmount;
    }
}

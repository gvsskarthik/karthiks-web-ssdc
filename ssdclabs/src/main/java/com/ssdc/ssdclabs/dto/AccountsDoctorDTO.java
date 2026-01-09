package com.ssdc.ssdclabs.dto;

public class AccountsDoctorDTO {

    private String doctorId;
    private String doctorName;
    private double commissionRate;
    private long patientCount;
    private double totalBill;
    private double totalCommission;

    public AccountsDoctorDTO(String doctorId,
                             String doctorName,
                             double commissionRate,
                             long patientCount,
                             double totalBill,
                             double totalCommission) {
        this.doctorId = doctorId;
        this.doctorName = doctorName;
        this.commissionRate = commissionRate;
        this.patientCount = patientCount;
        this.totalBill = totalBill;
        this.totalCommission = totalCommission;
    }

    public String getDoctorId() {
        return doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public double getCommissionRate() {
        return commissionRate;
    }

    public long getPatientCount() {
        return patientCount;
    }

    public double getTotalBill() {
        return totalBill;
    }

    public double getTotalCommission() {
        return totalCommission;
    }
}

package com.ssdc.ssdclabs.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(
    name = "doctors",
    indexes = {
        @Index(name = "idx_doctors_lab_name", columnList = "lab_id, name")
    }
)
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @Column(name = "lab_id", length = 6, nullable = false)
    private String labId;

    private String name;
    private String specialization;
    private String phone;
    private String hospital;
    private Double commissionRate;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLabId() { return labId; }
    public void setLabId(String labId) { this.labId = labId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    @SuppressWarnings("unused")
    public String getSpecialization() { return specialization; }
    @SuppressWarnings("unused")
    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    @SuppressWarnings("unused")
    public String getPhone() { return phone; }
    @SuppressWarnings("unused")
    public void setPhone(String phone) { this.phone = phone; }

    @SuppressWarnings("unused")
    public String getHospital() { return hospital; }
    @SuppressWarnings("unused")
    public void setHospital(String hospital) { this.hospital = hospital; }

    @SuppressWarnings("unused")
    public Double getCommissionRate() { return commissionRate; }
    @SuppressWarnings("unused")
    public void setCommissionRate(Double commissionRate) {
        this.commissionRate = commissionRate;
    }
}

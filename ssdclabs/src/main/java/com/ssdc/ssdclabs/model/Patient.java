package com.ssdc.ssdclabs.model;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(
    name = "patients",
    indexes = {
        @Index(name = "idx_patients_lab_visit_date", columnList = "lab_id, visit_date"),
        @Index(name = "idx_patients_lab_doctor", columnList = "lab_id, doctor_id"),
        @Index(name = "idx_patients_lab_mobile", columnList = "lab_id, mobile")
    }
)
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @Column(name = "lab_id", length = 6, nullable = false)
    private String labId;

    @Column(nullable = false)
    private String name;

    private Integer age;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Gender gender;

    private String mobile;
    private String address;

    @JsonIgnore
    private String password; // hashed

    @Column(name = "app_login_id", unique = true)
    private String appLoginId; // initially mobile number

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id")
    @JsonIgnore
    private Doctor doctor;

    @Transient
    private String doctorName;

    @Column(nullable = false)
    private Double amount = 0.0;

    @Column(nullable = false)
    private Double discount = 0.0;

    private Double paid = 0.0;

    private String status;

    private LocalDate visitDate;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLabId() { return labId; }
    public void setLabId(String labId) { this.labId = labId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    @SuppressWarnings("unused")
    public Integer getAge() { return age; }
    @SuppressWarnings("unused")
    public void setAge(Integer age) { this.age = age; }

    public Gender getGender() { return gender; }
    public void setGender(Gender gender) { this.gender = gender; }

    @SuppressWarnings("unused")
    public String getMobile() { return mobile; }
    @SuppressWarnings("unused")
    public void setMobile(String mobile) { this.mobile = mobile; }

    @SuppressWarnings("unused")
    public String getAddress() { return address; }
    @SuppressWarnings("unused")
    public void setAddress(String address) { this.address = address; }

    @JsonIgnore
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getAppLoginId() { return appLoginId; }
    public void setAppLoginId(String appLoginId) { this.appLoginId = appLoginId; }

    @JsonIgnore
    public Doctor getDoctor() { return doctor; }

    @JsonIgnore
    public void setDoctor(Doctor doctor) { this.doctor = doctor; }

    @JsonProperty("doctor")
    public String getDoctorName() {
        if (doctor != null && doctor.getName() != null) {
            return doctor.getName();
        }
        if (doctorName != null && !doctorName.trim().isEmpty()) {
            return doctorName;
        }
        return "SELF";
    }

    @JsonProperty("doctor")
    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public Double getAmount() { return amount; }
    @SuppressWarnings("unused")
    public void setAmount(Double amount) { this.amount = amount; }

    public Double getDiscount() { return discount; }
    @SuppressWarnings("unused")
    public void setDiscount(Double discount) { this.discount = discount; }

    public Double getPaid() { return paid == null ? 0.0 : paid; }
    @SuppressWarnings("unused")
    public void setPaid(Double paid) { this.paid = paid; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDate getVisitDate() { return visitDate; }
    public void setVisitDate(LocalDate visitDate) { this.visitDate = visitDate; }
}

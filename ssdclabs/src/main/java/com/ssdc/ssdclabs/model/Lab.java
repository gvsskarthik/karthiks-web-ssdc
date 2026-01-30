package com.ssdc.ssdclabs.model;

import java.time.Instant;
import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(name = "labs")
public class Lab {

    @Id
    @Column(name = "lab_id", length = 6, nullable = false)
    private String labId;

    @Column(name = "lab_name", nullable = false)
    private String labName;

    private String email;
    private String phone;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    @Column(name = "subscription_expiry")
    private LocalDate subscriptionExpiry;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public String getLabId() { return labId; }
    public void setLabId(String labId) { this.labId = labId; }

    public String getLabName() { return labName; }
    public void setLabName(String labName) { this.labName = labName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDate getSubscriptionExpiry() { return subscriptionExpiry; }
    public void setSubscriptionExpiry(LocalDate subscriptionExpiry) {
        this.subscriptionExpiry = subscriptionExpiry;
    }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}


package com.ssdc.ssdclabs.model;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;

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

    @Column(name = "onboarding_completed", nullable = false)
    private Boolean onboardingCompleted = Boolean.FALSE;

    @Column(name = "email_verified", nullable = false)
    private Boolean emailVerified = Boolean.FALSE;

    @JsonIgnore
    @Column(name = "email_verify_token_hash")
    private String emailVerifyTokenHash;

    @JsonIgnore
    @Column(name = "email_verify_expires_at")
    private OffsetDateTime emailVerifyExpiresAt;

    @JsonIgnore
    @Column(name = "email_verify_sent_at")
    private OffsetDateTime emailVerifySentAt;

    @JsonIgnore
    @Column(name = "email_verify_send_count", nullable = false)
    private Integer emailVerifySendCount = 0;

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

    public Boolean getOnboardingCompleted() { return onboardingCompleted; }
    public void setOnboardingCompleted(Boolean onboardingCompleted) {
        this.onboardingCompleted = onboardingCompleted;
    }

    public Boolean getEmailVerified() { return emailVerified; }
    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public String getEmailVerifyTokenHash() { return emailVerifyTokenHash; }
    public void setEmailVerifyTokenHash(String emailVerifyTokenHash) {
        this.emailVerifyTokenHash = emailVerifyTokenHash;
    }

    public OffsetDateTime getEmailVerifyExpiresAt() { return emailVerifyExpiresAt; }
    public void setEmailVerifyExpiresAt(OffsetDateTime emailVerifyExpiresAt) {
        this.emailVerifyExpiresAt = emailVerifyExpiresAt;
    }

    public OffsetDateTime getEmailVerifySentAt() { return emailVerifySentAt; }
    public void setEmailVerifySentAt(OffsetDateTime emailVerifySentAt) {
        this.emailVerifySentAt = emailVerifySentAt;
    }

    public Integer getEmailVerifySendCount() { return emailVerifySendCount; }
    public void setEmailVerifySendCount(Integer emailVerifySendCount) {
        this.emailVerifySendCount = emailVerifySendCount;
    }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

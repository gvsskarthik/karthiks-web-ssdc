package com.ssdc.ssdclabs.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "lab_print_settings")
public class LabPrintSettings {

    @Id
    @Column(name = "lab_id", length = 6, nullable = false)
    private String labId;

    @Column(name = "top_lines", nullable = false)
    private Integer topLines = 0;

    @Column(name = "bottom_lines", nullable = false)
    private Integer bottomLines = 0;

    @Column(name = "left_lines", nullable = false)
    private Integer leftLines = 0;

    @Column(name = "right_lines", nullable = false)
    private Integer rightLines = 0;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    @PreUpdate
    public void touchUpdatedAt() {
        updatedAt = Instant.now();
    }

    public String getLabId() { return labId; }
    public void setLabId(String labId) { this.labId = labId; }

    public Integer getTopLines() { return topLines; }
    public void setTopLines(Integer topLines) { this.topLines = topLines; }

    public Integer getBottomLines() { return bottomLines; }
    public void setBottomLines(Integer bottomLines) { this.bottomLines = bottomLines; }

    public Integer getLeftLines() { return leftLines; }
    public void setLeftLines(Integer leftLines) { this.leftLines = leftLines; }

    public Integer getRightLines() { return rightLines; }
    public void setRightLines(Integer rightLines) { this.rightLines = rightLines; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}


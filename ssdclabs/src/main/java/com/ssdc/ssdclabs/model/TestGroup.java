package com.ssdc.ssdclabs.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "test_groups",
    uniqueConstraints = @UniqueConstraint(columnNames = {"lab_id", "shortcut"}),
    indexes = {
        @Index(name = "idx_test_groups_lab_active", columnList = "lab_id, active"),
        @Index(name = "idx_test_groups_lab_shortcut", columnList = "lab_id, shortcut")
    }
)
public class TestGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @Column(name = "lab_id", length = 6, nullable = false)
    private String labId;

    @Column(name = "group_name", nullable = false)
    private String groupName;

    @Column(name = "group_price", nullable = false)
    private Double cost = 0.0;

    @Column
    private String category;

    @Column(nullable = false)
    private String shortcut;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder = 0;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(
        name = "show_group_name",
        nullable = false,
        columnDefinition = "TINYINT(1) DEFAULT 1"
    )
    private Boolean showGroupName = true;

    @Column(name = "report_layout", columnDefinition = "TEXT")
    private String reportLayout;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLabId() { return labId; }
    public void setLabId(String labId) { this.labId = labId; }

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }

    public Double getCost() { return cost; }
    public void setCost(Double cost) { this.cost = cost; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getShortcut() { return shortcut; }
    public void setShortcut(String shortcut) { this.shortcut = shortcut; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
    }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public Boolean getShowGroupName() { return showGroupName; }
    public void setShowGroupName(Boolean showGroupName) {
        this.showGroupName = showGroupName;
    }

    public String getReportLayout() { return reportLayout; }
    public void setReportLayout(String reportLayout) { this.reportLayout = reportLayout; }
}

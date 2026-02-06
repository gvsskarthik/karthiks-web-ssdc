package com.ssdc.ssdclabs.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(
    name = "tests",
    uniqueConstraints = @UniqueConstraint(columnNames = {"lab_id", "test_shortcut"}),
    indexes = {
        @Index(name = "idx_tests_lab_active", columnList = "lab_id, active"),
        @Index(name = "idx_tests_lab_shortcut", columnList = "lab_id, test_shortcut")
    }
)
public class Test {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @Column(name = "lab_id", length = 6, nullable = false)
    private String labId;

    @Column(name = "test_name", nullable = false)
    private String testName;

    @Column(name = "test_shortcut", nullable = false)
    private String shortcut;

    @Enumerated(EnumType.STRING)
    @Column(name = "test_type", nullable = false)
    private TestType testType;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder = 0;

    @Column(nullable = false)
    private Double cost = 0.0;

    private String category;

    @Column(name = "show_test_name_in_report")
    private Boolean showTestNameInReport = true;

    @OneToMany(
        mappedBy = "test",
        cascade = CascadeType.ALL,
        orphanRemoval = true
    )
    @JsonManagedReference("test-parameters")
    private List<TestParameter> parameters;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLabId() { return labId; }
    public void setLabId(String labId) { this.labId = labId; }

    public String getTestName() { return testName; }
    public void setTestName(String testName) { this.testName = testName; }

    public String getShortcut() { return shortcut; }
    public void setShortcut(String shortcut) { this.shortcut = shortcut; }

    public TestType getTestType() { return testType; }
    public void setTestType(TestType testType) { this.testType = testType; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    @SuppressWarnings("unused")
    public Integer getDisplayOrder() { return displayOrder; }
    @SuppressWarnings("unused")
    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
    }

    public Double getCost() { return cost; }
    public void setCost(Double cost) { this.cost = cost; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public Boolean getShowTestNameInReport() { return showTestNameInReport; }
    public void setShowTestNameInReport(Boolean showTestNameInReport) {
        this.showTestNameInReport = showTestNameInReport;
    }

    @SuppressWarnings("unused")
    public List<TestParameter> getParameters() { return parameters; }
    public void setParameters(List<TestParameter> parameters) {
        this.parameters = parameters;
    }
}

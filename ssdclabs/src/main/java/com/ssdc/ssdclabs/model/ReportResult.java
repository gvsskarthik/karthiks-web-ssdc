package com.ssdc.ssdclabs.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(
    name = "report_results",
    uniqueConstraints = @UniqueConstraint(
        columnNames = {"patient_id", "test_id", "parameter_id"}
    )
)
public class ReportResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_id", nullable = false)
    private Test test;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parameter_id", nullable = false)
    private TestParameter parameter;

    @Column(name = "result_value", columnDefinition = "TEXT")
    private String resultValue;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @SuppressWarnings("unused")
    public Patient getPatient() { return patient; }
    public void setPatient(Patient patient) { this.patient = patient; }

    public Test getTest() { return test; }
    public void setTest(Test test) { this.test = test; }

    public TestParameter getParameter() { return parameter; }
    public void setParameter(TestParameter parameter) {
        this.parameter = parameter;
    }

    public String getResultValue() { return resultValue; }
    public void setResultValue(String resultValue) {
        this.resultValue = resultValue;
    }
}

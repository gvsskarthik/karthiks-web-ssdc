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

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(name = "report_observations")
public class ReportObservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_id")
    private Test test;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String observation;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @SuppressWarnings("unused")
    public Patient getPatient() { return patient; }
    @SuppressWarnings("unused")
    public void setPatient(Patient patient) { this.patient = patient; }

    public Test getTest() { return test; }
    public void setTest(Test test) { this.test = test; }

    @SuppressWarnings("unused")
    public String getObservation() { return observation; }
    @SuppressWarnings("unused")
    public void setObservation(String observation) {
        this.observation = observation;
    }
}

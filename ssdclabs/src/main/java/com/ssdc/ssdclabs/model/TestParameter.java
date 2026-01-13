package com.ssdc.ssdclabs.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Convert;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(name = "test_parameters")
public class TestParameter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_id", nullable = false)
    @JsonBackReference("test-parameters")
    private Test test;

    @Column(name = "parameter_name", nullable = false)
    private String name;

    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_type", nullable = false)
    private ValueType valueType;

    @OneToMany(
        mappedBy = "parameter",
        cascade = CascadeType.ALL,
        orphanRemoval = true
    )
    @JsonManagedReference("parameter-ranges")
    private List<NormalRange> normalRanges;

    @Column(name = "allowed_values", columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> allowedValues;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Test getTest() { return test; }
    public void setTest(Test test) { this.test = test; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public ValueType getValueType() { return valueType; }
    public void setValueType(ValueType valueType) { this.valueType = valueType; }

    public List<NormalRange> getNormalRanges() { return normalRanges; }
    public void setNormalRanges(List<NormalRange> normalRanges) {
        this.normalRanges = normalRanges;
    }

    public List<String> getAllowedValues() { return allowedValues; }
    public void setAllowedValues(List<String> allowedValues) {
        this.allowedValues = allowedValues;
    }
}

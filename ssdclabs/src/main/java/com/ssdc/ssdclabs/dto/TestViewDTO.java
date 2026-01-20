package com.ssdc.ssdclabs.dto;

import java.util.List;

public class TestViewDTO {

    public Long id;
    public String testName;
    public String category;
    public String shortcut;
    public Double cost;
    public Boolean active;
    public Boolean commonResult;
    public List<TestUnitDTO> units;
    public List<TestNormalValueDTO> normalValues;
    public List<TestParameterViewDTO> parameters;

    public TestViewDTO(Long id,
                       String testName,
                       String category,
                       String shortcut,
                       Double cost,
                       Boolean active,
                       Boolean commonResult,
                       List<TestUnitDTO> units,
                       List<TestNormalValueDTO> normalValues,
                       List<TestParameterViewDTO> parameters) {
        this.id = id;
        this.testName = testName;
        this.category = category;
        this.shortcut = shortcut;
        this.cost = cost;
        this.active = active;
        this.commonResult = commonResult;
        this.units = units;
        this.normalValues = normalValues;
        this.parameters = parameters;
    }
}

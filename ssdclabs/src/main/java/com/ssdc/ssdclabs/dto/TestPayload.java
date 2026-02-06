package com.ssdc.ssdclabs.dto;

import java.util.List;

public class TestPayload {

    public String testName;
    public String category;
    public String shortcut;
    public Double cost;
    public Boolean active;
    public Boolean showTestNameInReport;
    public List<TestUnitDTO> units;
    public List<TestNormalValueDTO> normalValues;
    public List<TestParameterPayload> parameters;
}

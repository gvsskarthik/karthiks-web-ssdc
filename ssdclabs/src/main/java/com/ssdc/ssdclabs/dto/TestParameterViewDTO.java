package com.ssdc.ssdclabs.dto;

import java.util.List;

import com.ssdc.ssdclabs.model.ValueType;

public class TestParameterViewDTO {

    public Long id;
    public String name;
    public String unit;
    public ValueType valueType;
    public String normalText;
    public List<String> defaultResults;
    public Boolean allowNewLines;

    public TestParameterViewDTO(Long id,
                                String name,
                                String unit,
                                ValueType valueType,
                                String normalText,
                                List<String> defaultResults,
                                Boolean allowNewLines) {
        this.id = id;
        this.name = name;
        this.unit = unit;
        this.valueType = valueType;
        this.normalText = normalText;
        this.defaultResults = defaultResults;
        this.allowNewLines = allowNewLines;
    }
}

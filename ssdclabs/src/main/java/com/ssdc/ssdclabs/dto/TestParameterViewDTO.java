package com.ssdc.ssdclabs.dto;

import com.ssdc.ssdclabs.model.ValueType;

public class TestParameterViewDTO {

    public Long id;
    public String name;
    public String unit;
    public ValueType valueType;
    public String normalText;

    public TestParameterViewDTO(Long id,
                                String name,
                                String unit,
                                ValueType valueType,
                                String normalText) {
        this.id = id;
        this.name = name;
        this.unit = unit;
        this.valueType = valueType;
        this.normalText = normalText;
    }
}

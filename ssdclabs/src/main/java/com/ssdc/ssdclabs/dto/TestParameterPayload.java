package com.ssdc.ssdclabs.dto;

import java.util.List;

import com.ssdc.ssdclabs.model.ValueType;

public class TestParameterPayload {

    public String name;
    public String unit;
    public ValueType valueType;
    public List<String> allowedValues;
    public List<NormalRangePayload> normalRanges;
}

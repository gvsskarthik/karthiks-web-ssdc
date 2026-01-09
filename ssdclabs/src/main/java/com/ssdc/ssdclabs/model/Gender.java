package com.ssdc.ssdclabs.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Gender {
    MALE("Male"),
    FEMALE("Female"),
    ANY("Any");

    private final String label;

    Gender(String label) {
        this.label = label;
    }

    @JsonValue
    public String getLabel() {
        return label;
    }

    @JsonCreator
    public static Gender fromValue(String value) {
        if (value == null) {
            return ANY;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return ANY;
        }
        if ("male".equalsIgnoreCase(trimmed)) {
            return MALE;
        }
        if ("female".equalsIgnoreCase(trimmed)) {
            return FEMALE;
        }
        if ("any".equalsIgnoreCase(trimmed)) {
            return ANY;
        }
        return ANY;
    }
}

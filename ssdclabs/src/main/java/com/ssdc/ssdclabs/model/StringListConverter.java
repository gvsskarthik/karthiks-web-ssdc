package com.ssdc.ssdclabs.model;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> TYPE =
        new TypeReference<List<String>>() {};

    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return null;
        }
        List<String> cleaned = attribute.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .collect(Collectors.toList());
        if (cleaned.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(cleaned);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.trim().isEmpty()) {
            return null;
        }
        try {
            return MAPPER.readValue(dbData, TYPE);
        } catch (Exception ex) {
            return null;
        }
    }
}

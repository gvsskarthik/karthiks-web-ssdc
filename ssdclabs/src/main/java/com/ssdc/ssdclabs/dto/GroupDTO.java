package com.ssdc.ssdclabs.dto;

import java.util.List;

public record GroupDTO(
    Long id,
    String name,
    String shortcut,
    Double cost,
    List<TestDTO> tests
) {}

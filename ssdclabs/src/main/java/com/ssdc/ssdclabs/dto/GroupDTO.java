package com.ssdc.ssdclabs.dto;

import java.util.List;

public class GroupDTO {

    private Long id;
    private String name;
    private String shortcut;
    private Double cost;
    private List<TestDTO> tests;

    public GroupDTO(Long id,
                    String name,
                    String shortcut,
                    Double cost,
                    List<TestDTO> tests) {
        this.id = id;
        this.name = name;
        this.shortcut = shortcut;
        this.cost = cost;
        this.tests = tests;
    }

    // ===== GETTERS =====

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getShortcut() {
        return shortcut;
    }

    public Double getCost() {
        return cost;
    }

    public List<TestDTO> getTests() {
        return tests;
    }
}
package com.ssdc.ssdclabs.dto;

public class TemplateTestDTO {
    public Long id;
    public String testName;
    public String shortcut;
    public String category;
    public Double cost;
    public Boolean active;

    public TemplateTestDTO() {}

    public TemplateTestDTO(Long id,
                           String testName,
                           String shortcut,
                           String category,
                           Double cost,
                           Boolean active) {
        this.id = id;
        this.testName = testName;
        this.shortcut = shortcut;
        this.category = category;
        this.cost = cost;
        this.active = active;
    }
}


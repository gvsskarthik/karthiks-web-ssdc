package com.ssdc.ssdclabs.dto;

public class TestDTO {

    public Long id;
    public String name;
    public String shortcut;
    public Double cost;

    public TestDTO(Long id, String name, String shortcut, Double cost) {
        this.id = id;
        this.name = name;
        this.shortcut = shortcut;
        this.cost = cost;
    }
}
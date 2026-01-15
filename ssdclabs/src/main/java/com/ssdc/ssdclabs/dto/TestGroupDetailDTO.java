package com.ssdc.ssdclabs.dto;

import java.util.List;

public class TestGroupDetailDTO {

    public Long id;
    public String groupName;
    public String shortcut;
    public Double cost;
    public String category;
    public Boolean active;
    public List<Long> testIds;

    public TestGroupDetailDTO(Long id,
                              String groupName,
                              String shortcut,
                              Double cost,
                              String category,
                              Boolean active,
                              List<Long> testIds) {
        this.id = id;
        this.groupName = groupName;
        this.shortcut = shortcut;
        this.cost = cost;
        this.category = category;
        this.active = active;
        this.testIds = testIds;
    }
}

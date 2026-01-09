package com.ssdc.ssdclabs.dto;

import java.util.List;

public class TestGroupDetailDTO {

    public Long id;
    public String groupName;
    public String shortcut;
    public Double cost;
    public List<Long> testIds;

    public TestGroupDetailDTO(Long id,
                              String groupName,
                              String shortcut,
                              Double cost,
                              List<Long> testIds) {
        this.id = id;
        this.groupName = groupName;
        this.shortcut = shortcut;
        this.cost = cost;
        this.testIds = testIds;
    }
}

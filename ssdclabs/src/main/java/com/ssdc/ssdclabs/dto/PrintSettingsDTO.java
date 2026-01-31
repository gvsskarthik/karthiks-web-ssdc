package com.ssdc.ssdclabs.dto;

public class PrintSettingsDTO {
    public Integer topLines;
    public Integer bottomLines;
    public Integer leftLines;
    public Integer rightLines;

    public PrintSettingsDTO() {}

    public PrintSettingsDTO(Integer topLines,
                            Integer bottomLines,
                            Integer leftLines,
                            Integer rightLines) {
        this.topLines = topLines;
        this.bottomLines = bottomLines;
        this.leftLines = leftLines;
        this.rightLines = rightLines;
    }
}


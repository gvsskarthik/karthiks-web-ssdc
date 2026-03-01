package com.ssdc.ssdclabs;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AppConstants {

    private static String completedEditPin = "7702";

    @Value("${app.edit-pin:7702}")
    public void setCompletedEditPin(String pin) {
        completedEditPin = (pin == null || pin.trim().isEmpty()) ? "7702" : pin.trim();
    }

    public static boolean isValidCompletedEditPin(String editPin) {
        if (editPin == null) {
            return false;
        }
        return completedEditPin.equals(editPin.trim());
    }
}

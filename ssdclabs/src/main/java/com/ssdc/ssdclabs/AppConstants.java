package com.ssdc.ssdclabs;

public final class AppConstants {

    private AppConstants() {}

    /** PIN required to edit a COMPLETED patient record or report. */
    public static final String COMPLETED_EDIT_PIN = "7702";

    public static boolean isValidCompletedEditPin(String editPin) {
        if (editPin == null) {
            return false;
        }
        return COMPLETED_EDIT_PIN.equals(editPin.trim());
    }
}

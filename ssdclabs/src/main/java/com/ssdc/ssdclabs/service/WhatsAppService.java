package com.ssdc.ssdclabs.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class WhatsAppService {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppService.class);

    /**
     * Sends a WhatsApp message to the given mobile number.
     *
     * @param mobile  The recipient's mobile number (with or without country code).
     * @param message The message content.
     */
    public void sendMessage(String mobile, String message) {
        // TODO: Integrate with actual WhatsApp provider (Twilio, Meta, etc.)
        // For now, we just log it.
        logger.info("============== WHATSAPP MESSAGE START ==============");
        logger.info("To: {}", mobile);
        logger.info("Body:\n{}", message);
        logger.info("============== WHATSAPP MESSAGE END ================");
    }
}

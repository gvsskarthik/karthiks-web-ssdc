package com.ssdc.ssdclabs.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class WhatsAppService {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppService.class);

    public void sendMessage(String mobile, String message) {
        // Manual sending only — lab staff share credentials via WhatsApp button in Reports page.
        logger.info("WhatsApp (manual): To={} | {}", mobile, message);
    }
}

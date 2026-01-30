package com.ssdc.ssdclabs.service;

import java.nio.charset.StandardCharsets;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private final boolean enabled;
    private final String from;
    private final JavaMailSender sender;

    public MailService(
            @Value("${app.mail.enabled:false}") boolean enabled,
            @Value("${app.mail.from:}") String from,
            JavaMailSender sender) {
        this.enabled = enabled;
        this.from = from == null ? "" : from.trim();
        this.sender = Objects.requireNonNull(sender, "sender");
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void send(@NonNull String to,
                     @NonNull String subject,
                     @NonNull String body) {
        if (!enabled) {
            throw new IllegalStateException("Email is not enabled (app.mail.enabled=false)");
        }
        String safeTo = Objects.requireNonNull(to, "to").trim();
        if (safeTo.isEmpty()) {
            throw new IllegalArgumentException("Email address is required");
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setTo(safeTo);
        if (!from.isEmpty()) {
            msg.setFrom(from);
        }
        msg.setSubject(Objects.requireNonNull(subject, "subject"));
        msg.setText(new String(Objects.requireNonNull(body, "body").getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8));
        sender.send(msg);
    }
}


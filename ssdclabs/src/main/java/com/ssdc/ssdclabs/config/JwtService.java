package com.ssdc.ssdclabs.config;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtService {

    private final SecretKey key;
    private final long ttlSeconds;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.ttl-seconds:604800}") long ttlSeconds) {
        if (secret == null || secret.trim().length() < 32) {
            throw new IllegalStateException(
                "app.jwt.secret must be set and at least 32 characters"
            );
        }
        this.key = Keys.hmacShaKeyFor(secret.trim().getBytes(StandardCharsets.UTF_8));
        this.ttlSeconds = Math.max(60, ttlSeconds);
    }

    public String issueToken(String labId) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(ttlSeconds);
        return Jwts.builder()
            .subject(labId)
            .issuedAt(Date.from(now))
            .expiration(Date.from(exp))
            .signWith(key)
            .compact();
    }

    public String validateAndGetLabId(String token) {
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        try {
            Jws<Claims> parsed = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token.trim());
            String subject = parsed.getPayload().getSubject();
            return subject == null || subject.trim().isEmpty()
                ? null
                : subject.trim();
        } catch (Exception ex) {
            return null;
        }
    }
}


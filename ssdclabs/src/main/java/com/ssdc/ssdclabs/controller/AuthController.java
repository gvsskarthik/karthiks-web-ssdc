package com.ssdc.ssdclabs.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssdc.ssdclabs.dto.AuthLoginRequest;
import com.ssdc.ssdclabs.dto.AuthResponse;
import com.ssdc.ssdclabs.dto.AuthSignupRequest;
import com.ssdc.ssdclabs.service.AuthService;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody @NonNull AuthSignupRequest request) {
        try {
            AuthResponse response = authService.signup(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body("Signup failed");
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @NonNull AuthLoginRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(403).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body("Login failed");
        }
    }
}


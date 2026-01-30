package com.ssdc.ssdclabs.config;

import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.ssdc.ssdclabs.model.Lab;
import com.ssdc.ssdclabs.repository.LabRepository;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final LabRepository labRepo;

    public JwtAuthFilter(JwtService jwtService, LabRepository labRepo) {
        this.jwtService = jwtService;
        this.labRepo = labRepo;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring("Bearer ".length()).trim();
            String labId = jwtService.validateAndGetLabId(token);
            if (labId != null
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                Lab lab = labRepo.findById(labId).orElse(null);
                if (lab != null && Boolean.TRUE.equals(lab.getActive())) {
                    LocalDate expiry = lab.getSubscriptionExpiry();
                    if (expiry == null || !expiry.isBefore(LocalDate.now(ZoneId.of("Asia/Kolkata")))) {
                        UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                labId,
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_LAB_OWNER"))
                            );
                        authentication.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request)
                        );
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}

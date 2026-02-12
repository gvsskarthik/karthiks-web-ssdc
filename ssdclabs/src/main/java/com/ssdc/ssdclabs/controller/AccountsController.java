package com.ssdc.ssdclabs.controller;

import java.util.List;
import java.security.Principal;

import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.ssdc.ssdclabs.dto.AccountsDuePatientDTO;
import com.ssdc.ssdclabs.dto.AccountsDoctorDTO;
import com.ssdc.ssdclabs.dto.AccountsDoctorDetailDTO;
import com.ssdc.ssdclabs.dto.AccountsSummaryDTO;
import com.ssdc.ssdclabs.service.AccountsService;

@RestController
@RequestMapping("/accounts")
public class AccountsController {

    private final AccountsService accountsService;

    public AccountsController(AccountsService accountsService) {
        this.accountsService = accountsService;
    }

    @GetMapping("/summary")
    public @NonNull AccountsSummaryDTO getSummary(@NonNull Principal principal) {
        return accountsService.getSummary(principal.getName());
    }

    @GetMapping("/doctors")
    public List<AccountsDoctorDTO> getDoctors(@NonNull Principal principal) {
        return accountsService.getDoctorSummaries(principal.getName());
    }

    @GetMapping("/doctor/{doctorId}/details")
    public List<AccountsDoctorDetailDTO> getDoctorDetails(
            @PathVariable @NonNull String doctorId,
            @NonNull Principal principal) {
        return accountsService.getDoctorDetails(principal.getName(), doctorId);
    }

    @GetMapping("/details")
    public List<AccountsDoctorDetailDTO> getAllDetails(@NonNull Principal principal) {
        return accountsService.getAllDetails(principal.getName());
    }

    @GetMapping("/due")
    public List<AccountsDuePatientDTO> getDuePatients(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String doctorId,
            @RequestParam(defaultValue = "2000") int limit,
            @RequestParam(defaultValue = "0") int offset,
            @NonNull Principal principal) {
        try {
            return accountsService.getDuePatients(
                principal.getName(),
                from,
                to,
                doctorId,
                limit,
                offset
            );
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }
}

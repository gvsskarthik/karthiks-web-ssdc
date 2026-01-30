package com.ssdc.ssdclabs.controller;

import java.util.List;
import java.security.Principal;

import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}

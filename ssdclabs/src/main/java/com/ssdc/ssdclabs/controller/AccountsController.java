package com.ssdc.ssdclabs.controller;

import java.util.List;

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
    public @NonNull AccountsSummaryDTO getSummary() {
        return accountsService.getSummary();
    }

    @GetMapping("/doctors")
    public List<AccountsDoctorDTO> getDoctors() {
        return accountsService.getDoctorSummaries();
    }

    @GetMapping("/doctor/{doctorId}/details")
    public List<AccountsDoctorDetailDTO> getDoctorDetails(
            @PathVariable @NonNull String doctorId) {
        return accountsService.getDoctorDetails(doctorId);
    }
}

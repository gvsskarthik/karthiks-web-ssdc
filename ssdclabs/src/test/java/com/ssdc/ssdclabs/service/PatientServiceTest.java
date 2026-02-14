package com.ssdc.ssdclabs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssdc.ssdclabs.dto.RecentTaskDTO;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.repository.DoctorRepository;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.repository.ReportResultRepository;

@ExtendWith(MockitoExtension.class)
class PatientServiceTest {

    @Mock private PatientRepository patientRepo;
    @Mock private ReportResultRepository resultRepo;
    @Mock private DoctorRepository doctorRepo;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private WhatsAppService whatsAppService;

    @Test
    void getRecentTasks_ordersPresentToPast() {
        PatientService service = new PatientService(patientRepo, resultRepo, doctorRepo, passwordEncoder, whatsAppService);

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        LocalDate yesterday = today.minusDays(1);

        Patient todayPending1 = new Patient();
        todayPending1.setId(1L);
        todayPending1.setName("Today Pending 1");
        todayPending1.setVisitDate(today);
        todayPending1.setStatus("NOT COMPLETE");
        todayPending1.setAmount(0.0);
        todayPending1.setPaid(0.0);

        Patient todayPending2 = new Patient();
        todayPending2.setId(2L);
        todayPending2.setName("Today Pending 2");
        todayPending2.setVisitDate(today);
        todayPending2.setStatus("NOT COMPLETE");
        todayPending2.setAmount(0.0);
        todayPending2.setPaid(0.0);

        Patient todayDueOnly = new Patient();
        todayDueOnly.setId(3L);
        todayDueOnly.setName("Today Due");
        todayDueOnly.setVisitDate(today);
        todayDueOnly.setStatus("COMPLETED");
        todayDueOnly.setAmount(100.0);
        todayDueOnly.setPaid(0.0);

        Patient yesterdayPending = new Patient();
        yesterdayPending.setId(4L);
        yesterdayPending.setName("Yesterday Pending");
        yesterdayPending.setVisitDate(yesterday);
        yesterdayPending.setStatus("NOT COMPLETE");
        yesterdayPending.setAmount(0.0);
        yesterdayPending.setPaid(0.0);

        Patient yesterdayDueOnly = new Patient();
        yesterdayDueOnly.setId(5L);
        yesterdayDueOnly.setName("Yesterday Due");
        yesterdayDueOnly.setVisitDate(yesterday);
        yesterdayDueOnly.setStatus("COMPLETED");
        yesterdayDueOnly.setAmount(100.0);
        yesterdayDueOnly.setPaid(0.0);

        Patient pastPending = new Patient();
        pastPending.setId(6L);
        pastPending.setName("Past Pending");
        pastPending.setVisitDate(today.minusDays(3));
        pastPending.setStatus("NOT COMPLETE");
        pastPending.setAmount(0.0);
        pastPending.setPaid(0.0);

        Patient pastDueOnly = new Patient();
        pastDueOnly.setId(7L);
        pastDueOnly.setName("Past Due");
        pastDueOnly.setVisitDate(today.minusDays(4));
        pastDueOnly.setStatus("COMPLETED");
        pastDueOnly.setAmount(100.0);
        pastDueOnly.setPaid(0.0);

        when(patientRepo.findRecentPatients(eq("ssdc"), any()))
            .thenReturn(List.of(
                pastDueOnly,
                pastPending,
                yesterdayDueOnly,
                yesterdayPending,
                todayDueOnly,
                todayPending1,
                todayPending2
            ));

        List<RecentTaskDTO> tasks = service.getRecentTasks("ssdc", 20);
        List<Long> ids = tasks.stream().map(RecentTaskDTO::id).toList();

        // Today first (pending -> due-only), then yesterday, then older days.
        // Within the same bucket, higher id first.
        assertEquals(List.of(2L, 1L, 3L, 4L, 5L, 6L, 7L), ids);
    }
}


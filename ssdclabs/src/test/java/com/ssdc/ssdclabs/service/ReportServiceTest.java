package com.ssdc.ssdclabs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssdc.ssdclabs.dto.PatientTestResultDTO;
import com.ssdc.ssdclabs.model.Patient;
import com.ssdc.ssdclabs.model.ReportResult;
import com.ssdc.ssdclabs.model.TestParameter;
import com.ssdc.ssdclabs.repository.PatientRepository;
import com.ssdc.ssdclabs.repository.ReportResultRepository;
import com.ssdc.ssdclabs.repository.TestParameterRepository;
import com.ssdc.ssdclabs.repository.TestRepository;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock private ReportResultRepository resultRepo;
    @Mock private TestRepository testRepo;
    @Mock private TestParameterRepository paramRepo;
    @Mock private PatientRepository patientRepo;

    @Test
    void getResults_splitsMultilineForSingleParameterTest() {
        ReportService service = new ReportService(resultRepo, testRepo, paramRepo, patientRepo);

        Patient patient = new Patient();
        patient.setId(1L);
        patient.setLabId("ssdc");

        com.ssdc.ssdclabs.model.Test test = new com.ssdc.ssdclabs.model.Test();
        test.setId(10L);
        test.setTestName("Haemoglobin");

        TestParameter param = new TestParameter();
        param.setId(100L);
        param.setName("Haemoglobin");

        ReportResult row = new ReportResult();
        row.setId(1000L);
        row.setPatient(patient);
        row.setTest(test);
        row.setParameter(param);
        row.setSubTest("");
        row.setResultValue("13\n14\n15");

        when(resultRepo.findByPatient_Id("ssdc", 1L)).thenReturn(List.of(row));
        when(paramRepo.findByTest_IdOrderByIdAsc(10L)).thenReturn(List.of(param));

        List<PatientTestResultDTO> out = service.getResults("ssdc", 1L);

        assertEquals(3, out.size());
        assertEquals(null, out.get(0).subTest);
        assertEquals("13", out.get(0).resultValue);
        assertEquals("Haemoglobin::2", out.get(1).subTest);
        assertEquals("14", out.get(1).resultValue);
        assertEquals("Haemoglobin::3", out.get(2).subTest);
        assertEquals("15", out.get(2).resultValue);
    }

    @Test
    void getResults_splitsMultilineForMultiParameterTest() {
        ReportService service = new ReportService(resultRepo, testRepo, paramRepo, patientRepo);

        Patient patient = new Patient();
        patient.setId(1L);
        patient.setLabId("ssdc");

        com.ssdc.ssdclabs.model.Test test = new com.ssdc.ssdclabs.model.Test();
        test.setId(20L);
        test.setTestName("Differential Count");

        TestParameter param = new TestParameter();
        param.setId(200L);
        param.setName("Neutrophils");

        ReportResult row = new ReportResult();
        row.setId(2000L);
        row.setPatient(patient);
        row.setTest(test);
        row.setParameter(param);
        row.setSubTest("");
        row.setResultValue("50\n55");

        when(resultRepo.findByPatient_Id("ssdc", 1L)).thenReturn(List.of(row));
        when(paramRepo.findByTest_IdOrderByIdAsc(20L)).thenReturn(List.of(param, new TestParameter()));

        List<PatientTestResultDTO> out = service.getResults("ssdc", 1L);

        assertEquals(2, out.size());
        assertEquals("Neutrophils", out.get(0).subTest);
        assertEquals("50", out.get(0).resultValue);
        assertEquals("Neutrophils::2", out.get(1).subTest);
        assertEquals("55", out.get(1).resultValue);
    }

    @Test
    void saveResults_combinesLinesAndDeletesLineRows() {
        ReportService service = new ReportService(resultRepo, testRepo, paramRepo, patientRepo);

        Patient patient = new Patient();
        patient.setId(1L);
        patient.setLabId("ssdc");

        com.ssdc.ssdclabs.model.Test test = new com.ssdc.ssdclabs.model.Test();
        test.setId(10L);
        test.setTestName("Haemoglobin");

        TestParameter param = new TestParameter();
        param.setId(100L);
        param.setName("Haemoglobin");

        ReportResult base = new ReportResult();
        base.setId(1000L);
        base.setPatient(patient);
        base.setTest(test);
        base.setParameter(param);
        base.setSubTest("");
        base.setResultValue("old");

        ReportResult lineRow = new ReportResult();
        lineRow.setId(1001L);
        lineRow.setPatient(patient);
        lineRow.setTest(test);
        lineRow.setParameter(param);
        lineRow.setSubTest("Haemoglobin::2");
        lineRow.setResultValue("old2");

        when(patientRepo.findByIdAndLabId(1L, "ssdc")).thenReturn(Optional.of(patient));
        when(testRepo.findByIdAndLabId(10L, "ssdc")).thenReturn(Optional.of(test));
        when(paramRepo.findByTest_IdOrderByIdAsc(10L)).thenReturn(List.of(param));
        when(resultRepo.findByPatient_IdIn("ssdc", List.of(1L))).thenReturn(List.of(base, lineRow));
        when(resultRepo.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<PatientTestResultDTO> incoming = List.of(
            new PatientTestResultDTO(null, 1L, 10L, null, "13"),
            new PatientTestResultDTO(null, 1L, 10L, "Haemoglobin::2", "14"),
            new PatientTestResultDTO(null, 1L, 10L, "Haemoglobin::extra-1", "15")
        );

        service.saveResults("ssdc", incoming, null);

        ArgumentCaptor<List> saveCaptor = ArgumentCaptor.forClass(List.class);
        verify(resultRepo).saveAll(saveCaptor.capture());
        List<?> saved = saveCaptor.getValue();
        assertEquals(1, saved.size());
        ReportResult savedRow = (ReportResult) saved.get(0);
        assertEquals("13\n14\n15", savedRow.getResultValue());

        ArgumentCaptor<List> deleteCaptor = ArgumentCaptor.forClass(List.class);
        verify(resultRepo).deleteAll(deleteCaptor.capture());
        List<?> deleted = deleteCaptor.getValue();
        assertEquals(1, deleted.size());
        assertEquals(1001L, ((ReportResult) deleted.get(0)).getId());
    }
}

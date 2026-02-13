package com.ssdc.ssdclabs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.ssdc.ssdclabs.config.JwtService;
import com.ssdc.ssdclabs.dto.AuthLoginRequest;
import com.ssdc.ssdclabs.dto.AuthResponse;
import com.ssdc.ssdclabs.dto.AuthTwoFactorSetupResponse;
import com.ssdc.ssdclabs.dto.AuthTwoFactorStatusResponse;
import com.ssdc.ssdclabs.dto.AuthVerifyTwoFactorLoginRequest;
import com.ssdc.ssdclabs.model.Lab;
import com.ssdc.ssdclabs.repository.LabRepository;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private LabRepository labRepo;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private MailService mailService;
    @Mock private TotpService totpService;
    @Mock private TwoFactorSecretCryptoService twoFactorSecretCryptoService;

    @Test
    void login_without2fa_returnsToken() {
        AuthService service = service(600, 300, 5);
        AuthLoginRequest request = new AuthLoginRequest();
        request.labId = "LAB1";
        request.password = "secret";

        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.FALSE);

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(passwordEncoder.matches("secret", "hash")).thenReturn(true);
        when(jwtService.issueToken("lab1")).thenReturn("jwt-token");

        AuthResponse response = service.login(request);

        assertEquals("jwt-token", response.token);
        assertEquals("lab1", response.labId);
        assertEquals("Lab One", response.labName);
        assertEquals(Boolean.FALSE, response.twoFactorRequired);
        assertNull(response.loginChallenge);
        assertNull(response.challengeExpiresAt);
        verify(labRepo, never()).save(any(Lab.class));
    }

    @Test
    void login_with2fa_returnsChallengeNoToken() {
        AuthService service = service(600, 300, 5);
        AuthLoginRequest request = new AuthLoginRequest();
        request.labId = "lab1";
        request.password = "secret";

        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorSecretEnc("enc-secret");

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(passwordEncoder.matches("secret", "hash")).thenReturn(true);
        when(twoFactorSecretCryptoService.decrypt("enc-secret")).thenReturn("JBSWY3DPEHPK3PXP");
        when(labRepo.save(any(Lab.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthResponse response = service.login(request);

        assertNull(response.token);
        assertEquals(Boolean.TRUE, response.twoFactorRequired);
        assertNotNull(response.loginChallenge);
        assertNotNull(response.challengeExpiresAt);
        assertNotNull(lab.getTwoFactorLoginChallengeHash());
        assertEquals(64, lab.getTwoFactorLoginChallengeHash().length());
        assertEquals(0, lab.getTwoFactorLoginAttempts());
        assertNotNull(lab.getTwoFactorLoginExpiresAt());
        verify(jwtService, never()).issueToken(any());
        verify(labRepo).save(eq(lab));
    }

    @Test
    void verify2fa_success_returnsTokenAndClearsChallenge() {
        AuthService service = service(600, 300, 5);
        AuthVerifyTwoFactorLoginRequest request = new AuthVerifyTwoFactorLoginRequest();
        request.labId = "lab1";
        request.loginChallenge = "challenge-token";
        request.code = "123456";

        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorSecretEnc("enc-secret");
        lab.setTwoFactorLoginChallengeHash(sha256Hex("challenge-token"));
        lab.setTwoFactorLoginExpiresAt(OffsetDateTime.now().plusMinutes(5));
        lab.setTwoFactorLoginAttempts(0);

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(totpService.isValidCodeFormat("123456")).thenReturn(true);
        when(twoFactorSecretCryptoService.decrypt("enc-secret")).thenReturn("JBSWY3DPEHPK3PXP");
        when(totpService.verifyCode(eq("JBSWY3DPEHPK3PXP"), eq("123456"), any())).thenReturn(true);
        when(jwtService.issueToken("lab1")).thenReturn("jwt-token");
        when(labRepo.save(any(Lab.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthResponse response = service.verifyTwoFactorLogin(request);

        assertEquals("jwt-token", response.token);
        assertEquals(Boolean.FALSE, response.twoFactorRequired);
        assertNull(lab.getTwoFactorLoginChallengeHash());
        assertNull(lab.getTwoFactorLoginExpiresAt());
        assertEquals(0, lab.getTwoFactorLoginAttempts());
        verify(labRepo).save(eq(lab));
    }

    @Test
    void verify2fa_invalidCode_incrementsAttempts() {
        AuthService service = service(600, 300, 5);
        AuthVerifyTwoFactorLoginRequest request = new AuthVerifyTwoFactorLoginRequest();
        request.labId = "lab1";
        request.loginChallenge = "challenge-token";
        request.code = "123456";

        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorSecretEnc("enc-secret");
        lab.setTwoFactorLoginChallengeHash(sha256Hex("challenge-token"));
        lab.setTwoFactorLoginExpiresAt(OffsetDateTime.now().plusMinutes(5));
        lab.setTwoFactorLoginAttempts(0);

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(totpService.isValidCodeFormat("123456")).thenReturn(true);
        when(twoFactorSecretCryptoService.decrypt("enc-secret")).thenReturn("JBSWY3DPEHPK3PXP");
        when(totpService.verifyCode(eq("JBSWY3DPEHPK3PXP"), eq("123456"), any())).thenReturn(false);

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> service.verifyTwoFactorLogin(request)
        );

        assertEquals("Invalid verification code", ex.getMessage());
        assertEquals(1, lab.getTwoFactorLoginAttempts());
        assertNotNull(lab.getTwoFactorLoginChallengeHash());
        assertNotNull(lab.getTwoFactorLoginExpiresAt());
        verify(labRepo).save(eq(lab));
        verify(jwtService, never()).issueToken(any());
    }

    @Test
    void verify2fa_attemptLimit_clearsChallenge() {
        AuthService service = service(600, 300, 5);
        AuthVerifyTwoFactorLoginRequest request = new AuthVerifyTwoFactorLoginRequest();
        request.labId = "lab1";
        request.loginChallenge = "challenge-token";
        request.code = "123456";

        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorSecretEnc("enc-secret");
        lab.setTwoFactorLoginChallengeHash(sha256Hex("challenge-token"));
        lab.setTwoFactorLoginExpiresAt(OffsetDateTime.now().plusMinutes(5));
        lab.setTwoFactorLoginAttempts(4);

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(totpService.isValidCodeFormat("123456")).thenReturn(true);
        when(twoFactorSecretCryptoService.decrypt("enc-secret")).thenReturn("JBSWY3DPEHPK3PXP");
        when(totpService.verifyCode(eq("JBSWY3DPEHPK3PXP"), eq("123456"), any())).thenReturn(false);

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> service.verifyTwoFactorLogin(request)
        );

        assertEquals("Invalid verification code", ex.getMessage());
        assertNull(lab.getTwoFactorLoginChallengeHash());
        assertNull(lab.getTwoFactorLoginExpiresAt());
        assertEquals(0, lab.getTwoFactorLoginAttempts());
        verify(labRepo).save(eq(lab));
    }

    @Test
    void verify2fa_expiredChallenge_rejected() {
        AuthService service = service(600, 300, 5);
        AuthVerifyTwoFactorLoginRequest request = new AuthVerifyTwoFactorLoginRequest();
        request.labId = "lab1";
        request.loginChallenge = "challenge-token";
        request.code = "123456";

        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorSecretEnc("enc-secret");
        lab.setTwoFactorLoginChallengeHash(sha256Hex("challenge-token"));
        lab.setTwoFactorLoginExpiresAt(OffsetDateTime.now().minusSeconds(1));
        lab.setTwoFactorLoginAttempts(0);

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(totpService.isValidCodeFormat("123456")).thenReturn(true);

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> service.verifyTwoFactorLogin(request)
        );

        assertEquals("Invalid or expired login challenge", ex.getMessage());
        verify(labRepo, never()).save(any(Lab.class));
        verify(twoFactorSecretCryptoService, never()).decrypt(any());
    }

    @Test
    void verify2fa_invalidChallengeHash_rejected() {
        AuthService service = service(600, 300, 5);
        AuthVerifyTwoFactorLoginRequest request = new AuthVerifyTwoFactorLoginRequest();
        request.labId = "lab1";
        request.loginChallenge = "wrong-challenge";
        request.code = "123456";

        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorSecretEnc("enc-secret");
        lab.setTwoFactorLoginChallengeHash(sha256Hex("actual-challenge"));
        lab.setTwoFactorLoginExpiresAt(OffsetDateTime.now().plusMinutes(5));
        lab.setTwoFactorLoginAttempts(0);

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(totpService.isValidCodeFormat("123456")).thenReturn(true);

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> service.verifyTwoFactorLogin(request)
        );

        assertEquals("Invalid or expired login challenge", ex.getMessage());
        verify(labRepo, never()).save(any(Lab.class));
    }

    @Test
    void login_existingGuardsStillEnforced() {
        AuthService service = service(600, 300, 5);
        AuthLoginRequest request = new AuthLoginRequest();
        request.labId = "lab1";
        request.password = "secret";

        Lab emailNotVerified = baseLab();
        emailNotVerified.setEmailVerified(Boolean.FALSE);

        when(labRepo.findById("lab1")).thenReturn(Optional.of(emailNotVerified));

        IllegalStateException emailEx = assertThrows(IllegalStateException.class, () -> service.login(request));
        assertEquals("Email not verified", emailEx.getMessage());

        Lab locked = baseLab();
        locked.setActive(Boolean.FALSE);
        when(labRepo.findById("lab1")).thenReturn(Optional.of(locked));
        IllegalStateException lockEx = assertThrows(IllegalStateException.class, () -> service.login(request));
        assertEquals("Account locked", lockEx.getMessage());

        Lab expired = baseLab();
        expired.setSubscriptionExpiry(LocalDate.now(ZoneId.of("Asia/Kolkata")).minusDays(1));
        when(labRepo.findById("lab1")).thenReturn(Optional.of(expired));
        IllegalStateException expiryEx = assertThrows(IllegalStateException.class, () -> service.login(request));
        assertEquals("Subscription expired", expiryEx.getMessage());
    }

    @Test
    void twoFactorStatus_returnsCurrentState() {
        AuthService service = service(600, 300, 5);
        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorEnabledAt(OffsetDateTime.now().minusDays(1));

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));

        AuthTwoFactorStatusResponse response = service.getTwoFactorStatus("LAB1");

        assertEquals(Boolean.TRUE, response.enabled);
        assertEquals(lab.getTwoFactorEnabledAt(), response.enabledAt);
    }

    @Test
    void setupTwoFactor_storesSetupSecretAndReturnsUri() {
        AuthService service = service(600, 300, 5);
        Lab lab = baseLab();

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(passwordEncoder.matches("current-pass", "hash")).thenReturn(true);
        when(totpService.generateSecret()).thenReturn("JBSWY3DPEHPK3PXP");
        when(twoFactorSecretCryptoService.encrypt("JBSWY3DPEHPK3PXP")).thenReturn("setup-secret-enc");
        when(totpService.buildOtpAuthUri("lab1", "JBSWY3DPEHPK3PXP"))
            .thenReturn("otpauth://totp/SSDC%20Labs:lab1?secret=JBSWY3DPEHPK3PXP");
        when(labRepo.save(any(Lab.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthTwoFactorSetupResponse response = service.setupTwoFactor("lab1", "current-pass");

        assertEquals("JBSWY3DPEHPK3PXP", response.manualEntryKey);
        assertEquals("otpauth://totp/SSDC%20Labs:lab1?secret=JBSWY3DPEHPK3PXP", response.otpauthUri);
        assertNull(response.qrDataUrl);
        assertNotNull(response.setupExpiresAt);
        assertEquals("setup-secret-enc", lab.getTwoFactorSetupSecretEnc());
        assertNotNull(lab.getTwoFactorSetupExpiresAt());
        assertNull(lab.getTwoFactorLoginChallengeHash());
        assertNull(lab.getTwoFactorLoginExpiresAt());
        assertEquals(0, lab.getTwoFactorLoginAttempts());
    }

    @Test
    void enableTwoFactor_withValidCode_enablesAndClearsSetup() {
        AuthService service = service(600, 300, 5);
        Lab lab = baseLab();
        lab.setTwoFactorSetupSecretEnc("setup-secret-enc");
        lab.setTwoFactorSetupExpiresAt(OffsetDateTime.now().plusMinutes(10));

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(totpService.isValidCodeFormat("123456")).thenReturn(true);
        when(twoFactorSecretCryptoService.decrypt("setup-secret-enc")).thenReturn("JBSWY3DPEHPK3PXP");
        when(totpService.verifyCode(eq("JBSWY3DPEHPK3PXP"), eq("123456"), any())).thenReturn(true);
        when(twoFactorSecretCryptoService.encrypt("JBSWY3DPEHPK3PXP")).thenReturn("active-secret-enc");
        when(labRepo.save(any(Lab.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthTwoFactorStatusResponse response = service.enableTwoFactor("lab1", "123456");

        assertEquals(Boolean.TRUE, response.enabled);
        assertTrue(response.enabledAt != null);
        assertEquals(Boolean.TRUE, lab.getTwoFactorEnabled());
        assertEquals("active-secret-enc", lab.getTwoFactorSecretEnc());
        assertNull(lab.getTwoFactorSetupSecretEnc());
        assertNull(lab.getTwoFactorSetupExpiresAt());
    }

    @Test
    void disableTwoFactor_withValidPasswordAndCode_disablesAndClearsSecrets() {
        AuthService service = service(600, 300, 5);
        Lab lab = baseLab();
        lab.setTwoFactorEnabled(Boolean.TRUE);
        lab.setTwoFactorEnabledAt(OffsetDateTime.now().minusDays(1));
        lab.setTwoFactorSecretEnc("active-secret-enc");
        lab.setTwoFactorSetupSecretEnc("setup-secret-enc");
        lab.setTwoFactorSetupExpiresAt(OffsetDateTime.now().plusMinutes(10));
        lab.setTwoFactorLoginChallengeHash("hash");
        lab.setTwoFactorLoginExpiresAt(OffsetDateTime.now().plusMinutes(5));
        lab.setTwoFactorLoginAttempts(2);

        when(labRepo.findById("lab1")).thenReturn(Optional.of(lab));
        when(passwordEncoder.matches("current-pass", "hash")).thenReturn(true);
        when(totpService.isValidCodeFormat("123456")).thenReturn(true);
        when(twoFactorSecretCryptoService.decrypt("active-secret-enc")).thenReturn("JBSWY3DPEHPK3PXP");
        when(totpService.verifyCode(eq("JBSWY3DPEHPK3PXP"), eq("123456"), any())).thenReturn(true);
        when(labRepo.save(any(Lab.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthTwoFactorStatusResponse response = service.disableTwoFactor("lab1", "current-pass", "123456");

        assertEquals(Boolean.FALSE, response.enabled);
        assertNull(response.enabledAt);
        assertEquals(Boolean.FALSE, lab.getTwoFactorEnabled());
        assertNull(lab.getTwoFactorEnabledAt());
        assertNull(lab.getTwoFactorSecretEnc());
        assertNull(lab.getTwoFactorSetupSecretEnc());
        assertNull(lab.getTwoFactorSetupExpiresAt());
        assertNull(lab.getTwoFactorLoginChallengeHash());
        assertNull(lab.getTwoFactorLoginExpiresAt());
        assertEquals(0, lab.getTwoFactorLoginAttempts());
    }

    private AuthService service(long setupTtlSeconds, long challengeTtlSeconds, int maxAttempts) {
        return new AuthService(
            labRepo,
            passwordEncoder,
            jwtService,
            mailService,
            totpService,
            twoFactorSecretCryptoService,
            setupTtlSeconds,
            challengeTtlSeconds,
            maxAttempts,
            "https://ssdclabs.online"
        );
    }

    private Lab baseLab() {
        Lab lab = new Lab();
        lab.setLabId("lab1");
        lab.setLabName("Lab One");
        lab.setPasswordHash("hash");
        lab.setEmailVerified(Boolean.TRUE);
        lab.setActive(Boolean.TRUE);
        lab.setTwoFactorEnabled(Boolean.FALSE);
        return lab;
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}

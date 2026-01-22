package com.ssdc.lab.config.crypto;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

@Converter
@Component
public class AesAttributeConverter implements AttributeConverter<String, String> {
  private static final String CIPHER = "AES/GCM/NoPadding";
  private static final int IV_LENGTH = 12;
  private static final int TAG_LENGTH_BITS = 128;
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  @Value("${ssdc.crypto.key}")
  private String base64Key;

  private volatile SecretKey secretKey;

  @PostConstruct
  void init() {
    if (base64Key == null || base64Key.isBlank()) {
      throw new IllegalStateException("ssdc.crypto.key is required");
    }
    byte[] keyBytes = Base64.getDecoder().decode(base64Key);
    if (keyBytes.length != 32) {
      throw new IllegalStateException("ssdc.crypto.key must decode to 32 bytes");
    }
    this.secretKey = new SecretKeySpec(keyBytes, "AES");
  }

  @Override
  public String convertToDatabaseColumn(String attribute) {
    if (attribute == null) {
      return null;
    }
    try {
      byte[] iv = new byte[IV_LENGTH];
      SECURE_RANDOM.nextBytes(iv);
      Cipher cipher = Cipher.getInstance(CIPHER);
      GCMParameterSpec spec = new GCMParameterSpec(TAG_LENGTH_BITS, iv);
      cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec);
      byte[] cipherText = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
      ByteBuffer buffer = ByteBuffer.allocate(iv.length + cipherText.length);
      buffer.put(iv);
      buffer.put(cipherText);
      return Base64.getEncoder().encodeToString(buffer.array());
    } catch (Exception e) {
      throw new IllegalStateException("AES encryption failed", e);
    }
  }

  @Override
  public String convertToEntityAttribute(String dbData) {
    if (dbData == null) {
      return null;
    }
    try {
      byte[] allBytes = Base64.getDecoder().decode(dbData);
      if (allBytes.length <= IV_LENGTH) {
        throw new IllegalStateException("Invalid encrypted value");
      }
      ByteBuffer buffer = ByteBuffer.wrap(allBytes);
      byte[] iv = new byte[IV_LENGTH];
      buffer.get(iv);
      byte[] cipherText = new byte[buffer.remaining()];
      buffer.get(cipherText);
      Cipher cipher = Cipher.getInstance(CIPHER);
      GCMParameterSpec spec = new GCMParameterSpec(TAG_LENGTH_BITS, iv);
      cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);
      byte[] plain = cipher.doFinal(cipherText);
      return new String(plain, StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("AES decryption failed", e);
    }
  }
}

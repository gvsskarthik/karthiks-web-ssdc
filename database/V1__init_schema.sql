CREATE DATABASE IF NOT EXISTS ssdclabs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ssdclabs;

CREATE TABLE doctors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  specialization VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  hospital VARCHAR(150) NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  display_name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_doctors_name (name),
  INDEX idx_doctors_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE patients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  age INT NOT NULL,
  sex ENUM('MALE','FEMALE','OTHER') NOT NULL,
  mobile VARCHAR(30) NOT NULL,
  address VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patients_patient_code (patient_code),
  INDEX idx_patients_name (name),
  INDEX idx_patients_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE patient_visits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NULL,
  visit_date DATETIME NOT NULL,
  lab_name VARCHAR(150) NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('REGISTERED','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'REGISTERED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_patient_visits_patient_id (patient_id),
  KEY idx_patient_visits_doctor_id (doctor_id),
  CONSTRAINT fk_patient_visits_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_patient_visits_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_name VARCHAR(150) NOT NULL,
  shortcut VARCHAR(50) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  has_parameters TINYINT(1) NOT NULL DEFAULT 0,
  has_default_results TINYINT(1) NOT NULL DEFAULT 0,
  allow_multiple_results TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tests_shortcut (shortcut),
  INDEX idx_tests_name (test_name),
  INDEX idx_tests_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_parameters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_id BIGINT UNSIGNED NOT NULL,
  parameter_name VARCHAR(150) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  value_type ENUM('NUMBER','TEXT') NOT NULL,
  normal_min DECIMAL(10,2) NULL,
  normal_max DECIMAL(10,2) NULL,
  PRIMARY KEY (id),
  KEY idx_test_parameters_test_id (test_id),
  CONSTRAINT fk_test_parameters_test
    FOREIGN KEY (test_id) REFERENCES tests(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_default_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_id BIGINT UNSIGNED NOT NULL,
  default_value VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_test_default_results_test_id (test_id),
  CONSTRAINT fk_test_default_results_test
    FOREIGN KEY (test_id) REFERENCES tests(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_name VARCHAR(150) NOT NULL,
  shortcut VARCHAR(50) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_test_groups_shortcut (shortcut),
  INDEX idx_test_groups_name (group_name),
  INDEX idx_test_groups_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_tests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  test_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_group_tests (group_id, test_id),
  KEY idx_group_tests_group_id (group_id),
  KEY idx_group_tests_test_id (test_id),
  CONSTRAINT fk_group_tests_group
    FOREIGN KEY (group_id) REFERENCES test_groups(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_group_tests_test
    FOREIGN KEY (test_id) REFERENCES tests(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE patient_tests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visit_id BIGINT UNSIGNED NOT NULL,
  test_id BIGINT UNSIGNED NOT NULL,
  price_at_time DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_patient_tests_visit_id (visit_id),
  KEY idx_patient_tests_test_id (test_id),
  CONSTRAINT fk_patient_tests_visit
    FOREIGN KEY (visit_id) REFERENCES patient_visits(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_patient_tests_test
    FOREIGN KEY (test_id) REFERENCES tests(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_test_id BIGINT UNSIGNED NOT NULL,
  parameter_name VARCHAR(150) NOT NULL,
  result_value VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_test_results_patient_test_id (patient_test_id),
  CONSTRAINT fk_test_results_patient_test
    FOREIGN KEY (patient_test_id) REFERENCES patient_tests(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


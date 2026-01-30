-- Reference schema for SSDC Labs (MySQL)

CREATE TABLE labs (
  lab_id VARCHAR(6) PRIMARY KEY,
  lab_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  password_hash VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  subscription_expiry DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doctors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lab_id VARCHAR(6) NOT NULL,
  name VARCHAR(255),
  specialization VARCHAR(255),
  phone VARCHAR(50),
  hospital VARCHAR(255),
  commission_rate DECIMAL(5,2),
  INDEX idx_doctors_lab_name (lab_id, name)
);

CREATE TABLE patients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lab_id VARCHAR(6) NOT NULL,
  name VARCHAR(255) NOT NULL,
  age INT,
  gender VARCHAR(20) NOT NULL,
  mobile VARCHAR(50),
  address VARCHAR(255),
  doctor_id BIGINT,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(50),
  visit_date DATE,
  INDEX idx_patients_lab_visit_date (lab_id, visit_date),
  INDEX idx_patients_lab_doctor (lab_id, doctor_id),
  INDEX idx_patients_lab_mobile (lab_id, mobile),
  CONSTRAINT fk_patients_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE tests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lab_id VARCHAR(6) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  test_shortcut VARCHAR(100) NOT NULL,
  test_type VARCHAR(20) NOT NULL,
  active BOOLEAN NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  category VARCHAR(255),
  CONSTRAINT uk_tests_lab_shortcut UNIQUE (lab_id, test_shortcut),
  INDEX idx_tests_lab_active (lab_id, active)
);

CREATE TABLE test_parameters (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  test_id BIGINT NOT NULL,
  parameter_name VARCHAR(255) NOT NULL,
  unit VARCHAR(100),
  value_type VARCHAR(20) NOT NULL,
  default_result TEXT,
  allow_new_lines BOOLEAN,
  CONSTRAINT fk_params_test
    FOREIGN KEY (test_id) REFERENCES tests(id)
);

CREATE TABLE normal_ranges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  parameter_id BIGINT NOT NULL,
  gender VARCHAR(20) NOT NULL,
  min_value DECIMAL(10,2),
  max_value DECIMAL(10,2),
  text_value TEXT,
  CONSTRAINT fk_ranges_parameter
    FOREIGN KEY (parameter_id) REFERENCES test_parameters(id)
);

CREATE TABLE test_groups (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lab_id VARCHAR(6) NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  group_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category VARCHAR(255),
  shortcut VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL,
  CONSTRAINT uk_test_groups_lab_shortcut UNIQUE (lab_id, shortcut),
  INDEX idx_test_groups_lab_active (lab_id, active)
);

CREATE TABLE test_group_mappings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  group_id BIGINT NOT NULL,
  test_id BIGINT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  CONSTRAINT uk_group_test UNIQUE (group_id, test_id),
  CONSTRAINT fk_mapping_group
    FOREIGN KEY (group_id) REFERENCES test_groups(id),
  CONSTRAINT fk_mapping_test
    FOREIGN KEY (test_id) REFERENCES tests(id)
);

CREATE TABLE report_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  test_id BIGINT NOT NULL,
  parameter_id BIGINT NOT NULL,
  sub_test VARCHAR(255),
  result_value TEXT,
  INDEX idx_report_results_patient_id (patient_id),
  CONSTRAINT uk_report_result UNIQUE (patient_id, test_id, parameter_id, sub_test),
  CONSTRAINT fk_report_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_report_test
    FOREIGN KEY (test_id) REFERENCES tests(id),
  CONSTRAINT fk_report_param
    FOREIGN KEY (parameter_id) REFERENCES test_parameters(id)
);

-- Reference schema for SSDC Labs (MySQL)

CREATE TABLE doctors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  specialization VARCHAR(255),
  phone VARCHAR(50),
  hospital VARCHAR(255),
  commission_rate DECIMAL(5,2)
);

CREATE TABLE patients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
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
  CONSTRAINT fk_patients_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE tests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  test_name VARCHAR(255) NOT NULL,
  test_shortcut VARCHAR(100) NOT NULL UNIQUE,
  test_type VARCHAR(20) NOT NULL,
  active BOOLEAN NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  category VARCHAR(255)
);

CREATE TABLE test_parameters (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  test_id BIGINT NOT NULL,
  parameter_name VARCHAR(255) NOT NULL,
  unit VARCHAR(100),
  value_type VARCHAR(20) NOT NULL,
  default_result TEXT,
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
  group_name VARCHAR(255) NOT NULL,
  group_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category VARCHAR(255),
  shortcut VARCHAR(100) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL
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
  result_value TEXT,
  CONSTRAINT uk_report_result UNIQUE (patient_id, test_id, parameter_id),
  CONSTRAINT fk_report_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_report_test
    FOREIGN KEY (test_id) REFERENCES tests(id),
  CONSTRAINT fk_report_param
    FOREIGN KEY (parameter_id) REFERENCES test_parameters(id)
);

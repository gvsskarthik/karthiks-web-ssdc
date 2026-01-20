-- Sample master data for SSDC Labs (run after schema creation)

INSERT INTO test_groups
  (id, group_name, group_price, category, shortcut, display_order, active)
VALUES
  (1, 'Hematology', 500.00, 'Hematology', 'HEMA', 1, true);

INSERT INTO tests
  (id, test_name, test_shortcut, test_type, active, display_order, cost, category)
VALUES
  (1, 'Haemoglobin', 'HB', 'SINGLE', true, 1, 100.00, 'Hematology'),
  (2, 'Differential Count', 'DC', 'MULTI', true, 2, 200.00, 'Hematology');

INSERT INTO test_parameters
  (id, test_id, parameter_name, unit, value_type, default_result)
VALUES
  (1, 1, 'Haemoglobin', 'g/dL', 'NUMBER', NULL),
  (2, 2, 'Neutrophils', '%', 'NUMBER', NULL),
  (3, 2, 'Lymphocytes', '%', 'NUMBER', NULL),
  (4, 2, 'Eosinophils', '%', 'NUMBER', NULL),
  (5, 2, 'Monocytes', '%', 'NUMBER', NULL),
  (6, 2, 'Basophils', '%', 'NUMBER', NULL);

INSERT INTO normal_ranges
  (id, parameter_id, gender, min_value, max_value, text_value)
VALUES
  (1, 1, 'MALE', 13.0, 17.0, NULL),
  (2, 1, 'FEMALE', 12.0, 15.0, NULL),
  (3, 2, 'ANY', 40.0, 70.0, NULL),
  (4, 3, 'ANY', 20.0, 40.0, NULL),
  (5, 4, 'ANY', 1.0, 6.0, NULL),
  (6, 5, 'ANY', 2.0, 8.0, NULL),
  (7, 6, 'ANY', 0.0, 1.0, NULL);

INSERT INTO test_group_mappings
  (id, group_id, test_id, display_order)
VALUES
  (1, 1, 1, 1),
  (2, 1, 2, 2);

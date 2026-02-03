-- Create departments table for GA System
USE ga_system;

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dept_name VARCHAR(100) NOT NULL UNIQUE,
  dept_code VARCHAR(10) NOT NULL UNIQUE,
  description TEXT,
  manager_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default departments
INSERT INTO departments (dept_name, dept_code, description) VALUES
('Human Resources', 'HR', 'Human Resources Department'),
('Information Technology', 'IT', 'Information Technology Department'),
('Finance', 'FIN', 'Finance Department'),
('Operations', 'OPS', 'Operations Department'),
('Marketing', 'MKT', 'Marketing Department'),
('Sales', 'SAL', 'Sales Department'),
('Production', 'PROD', 'Production Department'),
('Quality Assurance', 'QA', 'Quality Assurance Department'),
('Research & Development', 'RND', 'Research & Development Department'),
('Administration', 'ADM', 'Administration Department')
ON DUPLICATE KEY UPDATE 
dept_name = VALUES(dept_name),
description = VALUES(description);
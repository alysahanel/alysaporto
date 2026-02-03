-- Database GA System
CREATE DATABASE IF NOT EXISTS ga_system;
USE ga_system;

-- Tabel Departments
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dept_id VARCHAR(10) NOT NULL UNIQUE,
  dept_name VARCHAR(100) NOT NULL
);

-- Tabel Roles
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

-- Tabel Users (Updated schema)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  full_name VARCHAR(100) NOT NULL,
  role ENUM('admin','cs','user') NOT NULL DEFAULT 'user',
  department VARCHAR(100),
  is_active TINYINT(1) DEFAULT 1,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabel Items (Updated schema)
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id VARCHAR(20) NOT NULL UNIQUE,
  item_name VARCHAR(100) NOT NULL,
  detail TEXT,
  stock INT DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  min_stock INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel Requests (Updated schema)
CREATE TABLE IF NOT EXISTS requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  req_id VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  item_id INT NOT NULL,
  qty INT NOT NULL,
  status ENUM('pending','approved','rejected','delivered') DEFAULT 'pending',
  comment TEXT,
  delivery_date DATE,
  sender VARCHAR(100),
  receiver VARCHAR(100),
  req_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Tabel Stock Transactions (Updated schema)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(20) NOT NULL UNIQUE,
  item_id INT NOT NULL,
  qty INT NOT NULL,
  type ENUM('in','out') NOT NULL,
  process VARCHAR(100),
  process_date DATE NOT NULL,
  department VARCHAR(100),
  pic VARCHAR(100),
  req_department VARCHAR(100),
  receiver VARCHAR(100),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabel Calendar Events (New)
CREATE TABLE IF NOT EXISTS calendar_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Insert default roles
INSERT IGNORE INTO roles (role_name) VALUES 
('admin'), 
('cs'), 
('user');

-- Insert departments
INSERT IGNORE INTO departments (dept_id, dept_name) VALUES 
('GA', 'GA (General Affairs)'),
('WH', 'Warehouse'),
('HRGA', 'HRGA Legal'),
('HSE', 'HSE'),
('FAT', 'Finance Accounting Tax'),
('PROD', 'Production'),
('QA', 'QA/QC'),
('PURCH', 'Purchasing'),
('PPIC', 'PPIC Warehouse EXIM'),
('IT', 'IT & Sales'),
('MAINT', 'Maintenance');

-- Insert default admin user
INSERT IGNORE INTO users (username, password, email, full_name, role, department, created_by) VALUES 
('admin', '$2b$10$ZgkoUNWCpy/at4PfR4e7SeHb7ApG43PMvW4nAMY.GTrvkSKwaDqdK', 'admin@ga-system.com', 'System Administrator', 'admin', 'GA', NULL);

-- Insert sample CS user
INSERT IGNORE INTO users (username, password, email, full_name, role, department, created_by) VALUES 
('cs1', '$2b$10$yKWqvAVACTxDHvh5U9SnOut35Qb4WJPYLPirFTodPatGK4T91C/Q6', 'cs1@ga-system.com', 'Customer Service 1', 'cs', 'WH', 1);

-- Insert sample regular user
INSERT IGNORE INTO users (username, password, email, full_name, role, department, created_by) VALUES 
('user1', '$2b$10$2rPQNr4HwmX95/adlJdZ9.jVLymbi/Ky8vF7zGHJ8K9mQJ5K6L7mO', 'user1@ga-system.com', 'Regular User 1', 'user', 'PROD', 1);
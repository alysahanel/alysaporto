-- Enhanced Database Schema for GA System
-- This script adds missing fields and tables for better real-world workflows

USE ga_system;

-- Add missing fields to requests table for better approval workflow
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS purpose TEXT AFTER qty,
ADD COLUMN IF NOT EXISTS priority ENUM('low','medium','high') DEFAULT 'medium' AFTER purpose,
ADD COLUMN IF NOT EXISTS approved_by INT AFTER status,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL AFTER approved_by,
ADD COLUMN IF NOT EXISTS rejected_reason TEXT AFTER approved_at,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT AFTER receiver,
ADD COLUMN IF NOT EXISTS urgency_level ENUM('normal','urgent','critical') DEFAULT 'normal' AFTER priority,
ADD FOREIGN KEY IF NOT EXISTS fk_approved_by (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create notifications table for system notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info','warning','success','error') DEFAULT 'info',
  is_read TINYINT(1) DEFAULT 0,
  related_table VARCHAR(50),
  related_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create request approval history table
CREATE TABLE IF NOT EXISTS request_approval_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  action ENUM('submitted','approved','rejected','delivered','cancelled') NOT NULL,
  performed_by INT NOT NULL,
  notes TEXT,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create item categories table for better organization
CREATE TABLE IF NOT EXISTS item_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add category to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS category_id INT AFTER detail,
ADD COLUMN IF NOT EXISTS supplier VARCHAR(100) AFTER min_stock,
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0.00 AFTER supplier,
ADD COLUMN IF NOT EXISTS location VARCHAR(100) AFTER price,
ADD FOREIGN KEY IF NOT EXISTS fk_item_category (category_id) REFERENCES item_categories(id) ON DELETE SET NULL;

-- Create stock alerts table
CREATE TABLE IF NOT EXISTS stock_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  alert_type ENUM('low_stock','out_of_stock','expired') NOT NULL,
  threshold_value INT,
  is_active TINYINT(1) DEFAULT 1,
  last_triggered TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Create user sessions table for better session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add audit fields to stock_transactions
ALTER TABLE stock_transactions 
ADD COLUMN IF NOT EXISTS notes TEXT AFTER receiver,
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(50) AFTER notes,
ADD COLUMN IF NOT EXISTS approved_by INT AFTER reference_number,
ADD FOREIGN KEY IF NOT EXISTS fk_stock_approved_by (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Insert default item categories
INSERT IGNORE INTO item_categories (category_name, description) VALUES 
('Office Supplies', 'General office supplies and stationery'),
('IT Equipment', 'Computer hardware and IT accessories'),
('Safety Equipment', 'Personal protective equipment and safety gear'),
('Cleaning Supplies', 'Cleaning materials and maintenance supplies'),
('Furniture', 'Office furniture and fixtures'),
('Electrical', 'Electrical components and tools'),
('Maintenance Tools', 'Tools and equipment for maintenance work'),
('Medical Supplies', 'First aid and medical equipment'),
('Communication', 'Communication devices and accessories'),
('Consumables', 'Consumable items and supplies');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_req_date ON requests(req_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_item_id ON stock_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(type);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);

-- Add triggers for automatic notifications
DELIMITER //

-- Trigger for new request notifications
CREATE TRIGGER IF NOT EXISTS tr_request_notification 
AFTER INSERT ON requests
FOR EACH ROW
BEGIN
  -- Notify admin and CS users about new requests
  INSERT INTO notifications (user_id, title, message, type, related_table, related_id)
  SELECT u.id, 
         CONCAT('New Request: ', i.item_name),
         CONCAT('User ', ur.full_name, ' has requested ', NEW.qty, ' ', i.unit, ' of ', i.item_name),
         'info',
         'requests',
         NEW.id
  FROM users u
  CROSS JOIN items i
  CROSS JOIN users ur
  WHERE i.id = NEW.item_id 
    AND ur.id = NEW.user_id
    AND u.role IN ('admin', 'cs');
END//

-- Trigger for request status change notifications
CREATE TRIGGER IF NOT EXISTS tr_request_status_notification 
AFTER UPDATE ON requests
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    -- Notify the requester about status change
    INSERT INTO notifications (user_id, title, message, type, related_table, related_id)
    SELECT NEW.user_id,
           CONCAT('Request Status Updated: ', i.item_name),
           CONCAT('Your request for ', NEW.qty, ' ', i.unit, ' of ', i.item_name, ' has been ', NEW.status),
           CASE NEW.status 
             WHEN 'approved' THEN 'success'
             WHEN 'rejected' THEN 'error'
             WHEN 'delivered' THEN 'success'
             ELSE 'info'
           END,
           'requests',
           NEW.id
    FROM items i
    WHERE i.id = NEW.item_id;
    
    -- Log the status change in approval history
    INSERT INTO request_approval_history (request_id, action, performed_by, previous_status, new_status, notes)
    VALUES (NEW.id, NEW.status, NEW.approved_by, OLD.status, NEW.status, 
            CASE NEW.status 
              WHEN 'rejected' THEN NEW.rejected_reason
              WHEN 'delivered' THEN NEW.delivery_notes
              ELSE NULL
            END);
  END IF;
END//

-- Trigger for low stock alerts
CREATE TRIGGER IF NOT EXISTS tr_low_stock_alert 
AFTER UPDATE ON items
FOR EACH ROW
BEGIN
  IF NEW.stock <= NEW.min_stock AND OLD.stock > OLD.min_stock THEN
    -- Create stock alert
    INSERT IGNORE INTO stock_alerts (item_id, alert_type, threshold_value)
    VALUES (NEW.id, 'low_stock', NEW.min_stock);
    
    -- Notify admin and CS users about low stock
    INSERT INTO notifications (user_id, title, message, type, related_table, related_id)
    SELECT u.id,
           'Low Stock Alert',
           CONCAT('Item "', NEW.item_name, '" is running low. Current stock: ', NEW.stock, ', Minimum: ', NEW.min_stock),
           'warning',
           'items',
           NEW.id
    FROM users u
    WHERE u.role IN ('admin', 'cs');
  END IF;
END//

DELIMITER ;

-- Update existing items with categories (based on item names)
UPDATE items SET category_id = 1 WHERE item_name LIKE '%kertas%' OR item_name LIKE '%pulpen%' OR item_name LIKE '%spidol%' OR item_name LIKE '%stapler%';
UPDATE items SET category_id = 2 WHERE item_name LIKE '%mouse%' OR item_name LIKE '%keyboard%' OR item_name LIKE '%kabel%' OR item_name LIKE '%tinta%';
UPDATE items SET category_id = 3 WHERE item_name LIKE '%helm%' OR item_name LIKE '%masker%' OR item_name LIKE '%sarung%';
UPDATE items SET category_id = 4 WHERE item_name LIKE '%tissue%' OR item_name LIKE '%sabun%' OR item_name LIKE '%pembersih%';
UPDATE items SET category_id = 7 WHERE item_name LIKE '%obeng%' OR item_name LIKE '%tang%' OR item_name LIKE '%WD-40%';

-- Create view for request summary with user and item details
CREATE OR REPLACE VIEW v_request_summary AS
SELECT 
  r.id,
  r.req_id,
  u.full_name as requester_name,
  u.department as requester_department,
  i.item_name,
  i.unit,
  r.qty as quantity,
  r.purpose,
  r.priority,
  r.urgency_level,
  r.status,
  r.req_date,
  r.delivery_date,
  approver.full_name as approved_by_name,
  r.approved_at,
  r.rejected_reason,
  r.delivery_notes,
  r.created_at,
  r.updated_at
FROM requests r
JOIN users u ON r.user_id = u.id
JOIN items i ON r.item_id = i.id
LEFT JOIN users approver ON r.approved_by = approver.id;

-- Create view for stock summary with category information
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT 
  i.id,
  i.item_id,
  i.item_name,
  i.detail,
  ic.category_name,
  i.unit,
  i.stock,
  i.min_stock,
  i.supplier,
  i.price,
  i.location,
  CASE 
    WHEN i.stock <= 0 THEN 'Out of Stock'
    WHEN i.stock <= i.min_stock THEN 'Low Stock'
    ELSE 'In Stock'
  END as stock_status,
  i.created_at,
  i.updated_at
FROM items i
LEFT JOIN item_categories ic ON i.category_id = ic.id;

-- Create view for user dashboard statistics
CREATE OR REPLACE VIEW v_user_dashboard_stats AS
SELECT 
  u.id as user_id,
  u.full_name,
  u.department,
  u.role,
  COUNT(r.id) as total_requests,
  COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_requests,
  COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_requests,
  COUNT(CASE WHEN r.status = 'delivered' THEN 1 END) as delivered_requests,
  COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) as rejected_requests
FROM users u
LEFT JOIN requests r ON u.id = r.user_id
GROUP BY u.id, u.full_name, u.department, u.role;

COMMIT;
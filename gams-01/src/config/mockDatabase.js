const bcrypt = require('bcrypt');

// Password hash for 'password123'
const PASSWORD_HASH = '$2b$10$ygjgwDQnLFrMg./AAYhYpue9CuYU80j7HEqB55tcsAStvMDlQVv0O';

const mockUsers = [
  {
    id: 1,
    user_id: 'GA-001',
    username: 'admin',
    password: PASSWORD_HASH, 
    full_name: 'System Administrator',
    role: 'admin',
    department: 'GA',
    dept_id: 1,
    role_id: 1,
    created_at: new Date(),
    pic_name: 'Admin PIC',
    dept_name: 'GA',
    role_name: 'admin',
    created_by: 'system'
  },
  {
    id: 2,
    user_id: 'WH-001',
    username: 'cs1',
    password: PASSWORD_HASH, 
    full_name: 'Customer Service 1',
    role: 'cs',
    department: 'WH',
    dept_id: 2,
    role_id: 2,
    created_at: new Date(),
    pic_name: 'CS PIC',
    dept_name: 'WH',
    role_name: 'cs',
    created_by: 'admin'
  },
  {
    id: 3,
    user_id: 'PROD-001',
    username: 'user1',
    password: PASSWORD_HASH, 
    full_name: 'Regular User 1',
    role: 'user',
    department: 'PROD',
    dept_id: 3,
    role_id: 3,
    created_at: new Date(),
    pic_name: 'User PIC',
    dept_name: 'PROD',
    role_name: 'user',
    created_by: 'admin'
  }
];

const mockRoles = [
    { id: 1, role_name: 'admin' },
    { id: 2, role_name: 'cs' },
    { id: 3, role_name: 'user' }
];

const mockDepts = [
    { id: 1, dept_name: 'IT' },
    { id: 2, dept_name: 'HRGA Legal' },
    { id: 3, dept_name: 'Finance' },
    { id: 4, dept_name: 'Operations' }
];

const mockItems = [
  { id: 1, item_id: 'ITM-001', item_name: 'Laptop Dell Latitude', detail: 'Office Laptop i5 16GB', stock: 5, unit: 'unit', description: 'Office Laptop i5 16GB', category: 'Electronics', min_stock: 2 },
  { id: 2, item_id: 'ITM-002', item_name: 'Mouse Wireless Logitech', detail: 'Logitech M331 Silent', stock: 15, unit: 'unit', description: 'Logitech M331 Silent', category: 'Electronics', min_stock: 5 },
  { id: 3, item_id: 'ATK-001', item_name: 'Kertas A4 PaperOne', detail: 'PaperOne 80gr', stock: 50, unit: 'rim', description: 'PaperOne 80gr', category: 'Stationery', min_stock: 10 },
  { id: 4, item_id: 'ATK-002', item_name: 'Ballpoint Pilot', detail: 'Black Ink 0.5mm', stock: 100, unit: 'pcs', description: 'Black Ink 0.5mm', category: 'Stationery', min_stock: 20 },
  { id: 5, item_id: 'FUR-001', item_name: 'Kursi Kerja Ergonomis', detail: 'Mesh back support', stock: 3, unit: 'unit', description: 'Mesh back support', category: 'Furniture', min_stock: 2 },
  { id: 6, item_id: 'ITM-003', item_name: 'Monitor LG 24"', detail: 'IPS 1080p', stock: 8, unit: 'unit', description: 'IPS 1080p', category: 'Electronics', min_stock: 3 }
];

const mockRequests = [
    {
        id: 1,
        req_id: 'REQ-001',
        req_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        formatted_req_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        formatted_created_at: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        created_at: new Date(Date.now() - 86400000),
        item_id: 'ATK-001', 
        item_name: 'Kertas A4 PaperOne',
        detail: 'PaperOne 80gr',
        qty: 2,
        unit: 'rim',
        department: 'HRGA Legal',
        pic: 'user', // username
        sender: 'Staff Member', // requester full name
        full_name: 'Staff Member', // Added for join simulation
        status: 'pending',
        comment: '',
        delivery_notes: '',
        delivery_date: null,
        formatted_delivery_date: null,
        receiver: null,
        user_id: 2
    },
    {
        id: 2,
        req_id: 'REQ-002',
        req_date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        formatted_req_date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        formatted_created_at: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        created_at: new Date(Date.now() - 172800000),
        item_id: 'ITM-002',
        item_name: 'Mouse Wireless Logitech',
        detail: 'Logitech M331 Silent',
        qty: 1,
        unit: 'unit',
        department: 'HRGA Legal',
        pic: 'user',
        sender: 'Staff Member',
        full_name: 'Staff Member',
        status: 'approved',
        comment: 'Approved by Spv',
        delivery_notes: '',
        delivery_date: null,
        formatted_delivery_date: null,
        receiver: null,
        user_id: 2
    },
    {
        id: 3,
        req_id: 'REQ-003',
        req_date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
        formatted_req_date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
        formatted_created_at: new Date(Date.now() - 259200000).toISOString().split('T')[0],
        created_at: new Date(Date.now() - 259200000),
        item_id: 'ITM-001',
        item_name: 'Laptop Dell Latitude',
        detail: 'Office Laptop i5 16GB',
        qty: 1,
        unit: 'unit',
        department: 'PROD',
        pic: 'user1',
        sender: 'Regular User 1',
        full_name: 'Regular User 1',
        status: 'rejected',
        comment: 'Out of budget',
        delivery_notes: '',
        delivery_date: null,
        formatted_delivery_date: null,
        receiver: null,
        user_id: 3
    }
];

const pool = {
  execute: async (sql, params) => {
    // console.log('Mock DB Execute:', sql, params); // Commented out to reduce noise
    const sqlLower = sql.toLowerCase().trim();

    // Users
    if (sqlLower.includes('from users where username = ?')) {
      const user = mockUsers.find(u => u.username === params[0]);
      return [[user], []];
    }
    
    if (sqlLower.includes('from users where id = ?')) {
        const user = mockUsers.find(u => u.id === params[0]);
        return [[user], []];
    }

    if (sqlLower.includes('select u.id, u.username')) { // getAllUsers
        return [mockUsers, []];
    }

    if (sqlLower.includes('insert into users')) {
        return [{ insertId: mockUsers.length + 1 }, []];
    }

    // Roles & Departments
    if (sqlLower.includes('select * from roles')) {
        return [mockRoles, []];
    }
    if (sqlLower.includes('select * from departments')) {
        return [mockDepts, []];
    }

    // Items
    if (sqlLower.includes('select * from items') || sqlLower.includes('select i.*, c.category_name')) {
        return [mockItems, []];
    }
    
    // Items Count
    if (sqlLower.includes('from items') && sqlLower.includes('count(*)')) {
        // Logic for "stock <= min_stock"
        if (sqlLower.includes('stock <= min_stock') || sqlLower.includes('stock <= i.min_stock')) {
             const count = mockItems.filter(i => i.stock <= i.min_stock).length;
             return [[{ count }], []];
        }
        return [[{ count: mockItems.length }], []];
    }

    // Requests
    if (sqlLower.includes('from requests')) {
        // Handle Count queries
        if (sqlLower.includes('count(*)')) {
             let filtered = mockRequests;
             
             // Filter by status
             if (sqlLower.includes('status = "approved"') || sqlLower.includes("status = 'approved'")) {
                 filtered = filtered.filter(r => r.status === 'approved');
             } else if (sqlLower.includes('status = "pending"') || sqlLower.includes("status = 'pending'")) {
                 filtered = filtered.filter(r => r.status === 'pending');
             } else if (sqlLower.includes('status = "delivered"') || sqlLower.includes("status = 'delivered'")) {
                 filtered = filtered.filter(r => r.status === 'delivered');
             } else if (sqlLower.includes('status = "rejected"') || sqlLower.includes("status = 'rejected'")) {
                 filtered = filtered.filter(r => r.status === 'rejected');
             }
             
             // Filter by user_id
             if (sqlLower.includes('user_id = ?') && params && params[0]) {
                 filtered = filtered.filter(r => r.user_id === params[0]);
             }

             return [[{ count: filtered.length }], []];
        }

        // Handle SELECT list
        return [mockRequests, []];
    }
    
    // Date Format queries for Dashboard
    if (sqlLower.includes('date_format(curdate()')) {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        return [[{ startOfMonth: startOfMonth }], []];
    }
    
    if (sqlLower.includes('date_format(date_add(curdate()')) {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split('T')[0];
        return [[{ nextStartOfMonth: nextMonth }], []];
    }

    // INFORMATION_SCHEMA queries
    if (sqlLower.includes('information_schema.columns')) {
        if (sqlLower.includes('count(*)')) {
             // Simulate that columns exist (like admin_comment, req_date, purpose)
             return [[{ cnt: 1 }], []];
        }
        if (sqlLower.includes('column_name as col')) {
            // Return 'qty' for quantity column check
            if (sqlLower.includes('qty') || sqlLower.includes('quantity')) {
                 return [[{ col: 'qty' }], []];
            }
            // Return 'detail' for detail column check
            if (sqlLower.includes('detail')) {
                 return [[{ col: 'detail' }], []];
            }
             return [[{ col: 'dummy_col' }], []];
        }
    }

    // Dashboard Stats (Fallback)
    if (sqlLower.includes('count(*)')) {
        return [[{ count: 5 }], []]; // Dummy count
    }
    
    // Handle COUNT(DISTINCT ...)
    if (sqlLower.includes('count(distinct')) {
        return [[{ count: 4 }], []]; // Dummy department count
    }

    // Default fallback for SELECTs - return empty array to avoid crashes
    if (sqlLower.startsWith('select')) {
        return [[], []];
    }

    // Default fallback for INSERT/UPDATE/DELETE
    return [{ affectedRows: 1, insertId: 1 }, []];
  },
  query: async (sql, params) => {
      // console.log('Mock DB Query:', sql, params);
      if (typeof sql === 'string' && sql.toLowerCase().trim().startsWith('select')) {
          if (sql.toLowerCase().includes('create database') || sql.toLowerCase().includes('create table')) {
              return [{ warningStatus: 0 }, []];
          }
          return [[[]], []];
      }
      return [{ affectedRows: 1 }, []];
  },
  getConnection: async () => {
      return {
          release: () => {},
          execute: pool.execute,
          query: pool.query,
          beginTransaction: async () => {},
          commit: async () => {},
          rollback: async () => {}
      };
  },
  on: () => {} 
};

module.exports = { pool };

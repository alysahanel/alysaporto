let currentUser = null;
let currentPage = 'dashboard';
const API_BASE = 'api';
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    initializeItemDropdowns();
});
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}
async function checkAuth() {
    try {
        showLoading(true);
        const token = localStorage.getItem('token');
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include',
            headers: headers
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
            currentUser = data.user;
            showMainApp();
            window.location.href = 'dashboard.html';
            return;
        }
        }
        showLoginPage();
    } catch (error) {
        console.error('Auth check error:', error);
        showLoginPage();
    } finally {
        showLoading(false);
    }
}
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            showMainApp();
            window.location.href = 'dashboard.html';
        } else {
            showError('loginError', data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('loginError', 'Terjadi kesalahan saat login');
    } finally {
        showLoading(false);
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    localStorage.removeItem('token');
    currentUser = null;
    showLoginPage();
}
function showLoginPage() {
    document.getElementById('loginPage').classList.remove('d-none');
    document.getElementById('mainApp').classList.add('d-none');
}

function showMainApp() {
    document.getElementById('loginPage').classList.add('d-none');
    document.getElementById('mainApp').classList.remove('d-none');
    document.getElementById('userDisplayName').textContent = currentUser.pic_name;
    setupSidebar();
}

function setupSidebar() {
    return;
}
function loadPage(page) {
    currentPage = page;
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.closest('.nav-link').classList.add('active');
    const pageTitle = document.getElementById('pageTitle');
    const titles = {
        requests: 'Requests',
        stock: 'Item Stock',
        calendar: 'Calendar',
        accounts: 'Account Management',
        profile: 'Profile'
    };
    pageTitle.textContent = titles[page] || 'Requests';
    switch (page) {
        case 'requests':
            window.location.href = 'requests.html';
            break;
        case 'stock':
            window.location.href = 'stock.html';
            break;
        case 'calendar':
            window.location.href = 'calendar.html';
            break;
        case 'accounts':
            window.location.href = 'accounts.html';
            break;
        case 'profile':
            window.location.href = 'profile.html';
            break;
        default:
            window.location.href = 'requests.html';
    }
}
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/stats`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            renderDashboard(data.data);
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

function renderDashboard(data) {
    const contentArea = document.getElementById('contentArea');
    
    if (currentUser.role_name === 'admin' || currentUser.role_name === 'cs') {
        contentArea.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-3 mb-3">
                    <div class="card dashboard-card">
                        <div class="card-body">
                            <h3>${data.pendingCount || 0}</h3>
                            <p>Total Pending Requests</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card dashboard-card">
                        <div class="card-body">
                            <h3>${data.totalItems || 0}</h3>
                            <p>Total Items</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card dashboard-card">
                        <div class="card-body">
                            <h3>${data.totalUsers || 0}</h3>
                            <p>Total Users</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card dashboard-card">
                        <div class="card-body">
                            <h3>${data.totalDepartments || 0}</h3>
                            <p>Total Departments</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Search Item Stock</h5>
                        </div>
                        <div class="card-body">
                            <div class="input-group">
                                <input type="text" class="form-control" id="dashboardItemSearch" placeholder="Search items...">
                                <button class="btn btn-primary" onclick="searchItemFromDashboard()">
                                    <i class="fas fa-search"></i> Search
                                </button>
                            </div>
                            <div id="dashboardSearchResults" class="mt-3"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Mini Calendar</h5>
                        </div>
                        <div class="card-body">
                            <div id="dashboardCalendar"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Recent Requests</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Request ID</th>
                                            <th>Item</th>
                                            <th>Qty</th>
                                            <th>Department</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${data.recentRequests ? data.recentRequests.map(req => `
                                            <tr>
                                                <td>${req.req_id}</td>
                                                <td>${req.item_name}</td>
                                                <td>${req.qty} ${req.unit}</td>
                                                <td>${req.dept_name || 'N/A'}</td>
                                                <td><span class="badge bg-${getStatusColor(req.status)}">${req.status}</span></td>
                                                <td>${formatDate(req.formatted_req_date || req.req_date)}</td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="6">No recent requests</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        initDashboardCalendar();
    } else {
        contentArea.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-4 mb-3">
                    <div class="card dashboard-card">
                        <div class="card-body">
                            <h3>${data.pendingCount}</h3>
                            <p>Pending Requests</p>
                        </div>
                    </div>
                </div>
                ${currentUser.role_name === 'cs' ? `
                <div class="col-md-4 mb-3">
                    <div class="card dashboard-card warning">
                        <div class="card-body">
                            <h3>${data.pendingDeliveryCount}</h3>
                            <p>Pending Delivery</p>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Recent Requests</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Request ID</th>
                                            <th>Item</th>
                                            <th>Qty</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${data.recentRequests.map(req => `
                                            <tr>
                                                <td>${req.req_id}</td>
                                                <td>${req.item_name}</td>
                                                <td>${req.qty} ${req.unit}</td>
                                                <td><span class="badge bg-${getStatusColor(req.status)}">${req.status}</span></td>
                                                <td>${formatDate(req.formatted_req_date || req.req_date)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
async function loadItems() {
    try {
        const response = await fetch(`${API_BASE}/items`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            renderItems(data.data);
        }
    } catch (error) {
        console.error('Items load error:', error);
    }
}
function renderItems(items) {
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="input-group" style="max-width: 300px;">
                <input type="text" class="form-control" placeholder="Search items..." id="itemSearch">
                <button class="btn btn-outline-secondary" onclick="searchItems()">
                    <i class="fas fa-search"></i>
                </button>
            </div>
            ${currentUser.role_name === 'admin' || currentUser.role_name === 'cs' ? `
            <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addItemModal">
                <i class="fas fa-plus me-2"></i>Tambah Item
            </button>
            ` : ''}
        </div>
        
        <div class="card">
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Item ID</th>
                                <th>Nama Item</th>
                                <th>Detail</th>
                                <th>Unit</th>
                                <th>Stock</th>
                                <th>Min Stock</th>
                                <th>Status</th>
                                ${currentUser.role_name === 'admin' || currentUser.role_name === 'cs' ? '<th>Actions</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td>${item.item_id}</td>
                                    <td>${item.item_name}</td>
                                    <td>${item.detail || '-'}</td>
                                    <td>${item.unit}</td>
                                    <td>${item.stock}</td>
                                    <td>${item.min_stock}</td>
                                    <td>
                                        <span class="badge bg-${item.stock <= item.min_stock ? 'danger' : 'success'}">
                                            ${item.stock <= item.min_stock ? 'Low Stock' : 'Available'}
                                        </span>
                                    </td>
                                    ${currentUser.role_name === 'admin' || currentUser.role_name === 'cs' ? `
                                    <td>
                                        <button class="btn btn-sm btn-primary" onclick="editItem(${item.id})">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </td>
                                    ` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    loadItemsForRequest();
}
async function loadRequests() {
    try {
        const response = await fetch(`${API_BASE}/requests`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            renderRequests(data.data);
        }
    } catch (error) {
        console.error('Requests load error:', error);
    }
}

function renderRequests(requests) {
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Daftar Request</h5>
            <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addRequestModal">
                <i class="fas fa-plus me-2"></i>Buat Request
            </button>
        </div>
        
        <div class="card">
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Request ID</th>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Department</th>
                                <th>PIC</th>
                                <th>Status</th>
                                <th>Date</th>
                                ${currentUser.role_name === 'admin' || currentUser.role_name === 'cs' ? '<th>Actions</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${requests.map(req => `
                                <tr>
                                    <td>${req.req_id}</td>
                                    <td>${req.item_name}</td>
                                    <td>${req.qty} ${req.unit}</td>
                                    <td>${req.dept}</td>
                                    <td>${req.pic}</td>
                                    <td><span class="badge bg-${getStatusColor(req.status)}">${req.status}</span></td>
                                    <td>${formatDate(req.formatted_req_date || req.req_date)}</td>
                                    ${(currentUser.role_name === 'admin' || currentUser.role_name === 'cs') && req.status === 'pending' ? `
                                    <td>
                                        <button class="btn btn-sm btn-success me-1" onclick="approveRequest(${req.id})">
                                            <i class="fas fa-check"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="rejectRequest(${req.id})">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </td>
                                    ` : '<td>-</td>'}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('d-none');
    } else {
        loading.classList.add('d-none');
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.remove('d-none');
    
    setTimeout(() => {
        errorElement.classList.add('d-none');
    }, 5000);
}

function getStatusColor(status) {
    const colors = {
        pending: 'warning',
        approved: 'success',
        rejected: 'danger'
    };
    return colors[status] || 'secondary';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID');
}
async function loadItemsForRequest() {
    try {
        const response = await fetch(`${API_BASE}/items`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('requestItemId');
            select.innerHTML = '<option value="">Pilih Item</option>' +
                data.data.map(item => `<option value="${item.id}">${item.item_name} (${item.item_id})</option>`).join('');
        }
    } catch (error) {
        console.error('Load items error:', error);
    }
}

async function saveItem() {
    const formData = {
        item_name: document.getElementById('itemName').value,
        detail: document.getElementById('itemDetail').value,
        unit: document.getElementById('itemUnit').value,
        stock: document.getElementById('itemStock').value,
        min_stock: document.getElementById('itemMinStock').value
    };
    const itemId = document.getElementById('itemId').value.trim();
    if (itemId) {
        formData.item_id = itemId;
    }
    try {
        const response = await fetch(`${API_BASE}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('addItemModal')).hide();
            document.getElementById('addItemForm').reset();
            loadItems();
            alert(`Item berhasil dibuat dengan ID: ${data.data.item_id}`);
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Save item error:', error);
        alert('Terjadi kesalahan saat menyimpan item');
    }
}

async function saveRequest() {
    const formData = {
        item_id: document.getElementById('requestItemId').value,
        qty: document.getElementById('requestQty').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('addRequestModal')).hide();
            loadRequests();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Save request error:', error);
        alert('Terjadi kesalahan saat membuat request');
    }
}

async function approveRequest(requestId) {
    if (confirm('Apakah Anda yakin ingin menyetujui request ini?')) {
        try {
            const response = await fetch(`${API_BASE}/requests/${requestId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ status: 'approved' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                loadRequests();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Approve request error:', error);
            alert('Terjadi kesalahan saat menyetujui request');
        }
    }
}

async function rejectRequest(requestId) {
    const comment = prompt('Alasan penolakan (opsional):');
    if (comment !== null) {
        try {
            const response = await fetch(`${API_BASE}/requests/${requestId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ status: 'rejected', comment })
            });
            
            const data = await response.json();
            
            if (data.success) {
                loadRequests();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Reject request error:', error);
            alert('Terjadi kesalahan saat menolak request');
        }
    }
}
function loadCalendar() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <h5>Calendar Feature</h5>
                <p>Calendar functionality will be implemented here.</p>
            </div>
        </div>
    `;
}

function loadUsers() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h4><i class="fas fa-users me-2"></i>User Management</h4>
            <button class="btn btn-primary" onclick="showAddUserModal()">
                <i class="fas fa-plus me-1"></i>Add User
            </button>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Full Name</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="usersTableBody">
                            <tr>
                                <td colspan="7" class="text-center">Loading users...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    fetchUsers();
}

async function fetchUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            displayUsers(result.data || []);
        } else {
            document.getElementById('usersTableBody').innerHTML = `
                <tr><td colspan="7" class="text-center text-danger">Failed to load users</td></tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        document.getElementById('usersTableBody').innerHTML = `
            <tr><td colspan="7" class="text-center text-danger">Error loading users</td></tr>
        `;
    }
}
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="text-center">No users found</td></tr>
        `;
        return;
    }
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.full_name || user.pic_name}</td>
            <td>
                <span class="badge ${getRoleBadgeClass(user.role || getRoleById(user.role_id))}">
                    ${user.role || getRoleById(user.role_id)}
                </span>
            </td>
            <td>${user.department || 'N/A'}</td>
            <td>
                <span class="badge ${user.is_active ? 'bg-success' : 'bg-danger'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editUser(${user.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="resetPassword(${user.id})">
                    <i class="fas fa-key"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function getRoleBadgeClass(role) {
    switch(role?.toLowerCase()) {
        case 'admin': return 'bg-danger';
        case 'cs': return 'bg-warning';
        case 'user': return 'bg-info';
        default: return 'bg-secondary';
    }
}

function getRoleById(roleId) {
    switch(roleId) {
        case 1: return 'admin';
        case 2: return 'cs';
        case 3: return 'user';
        default: return 'unknown';
    }
}
function searchItemFromDashboard() {
    const searchTerm = document.getElementById('dashboardItemSearch').value;
    if (!searchTerm.trim()) return;
    
    fetch(`${API_BASE}/items/search?q=${encodeURIComponent(searchTerm)}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const resultsDiv = document.getElementById('dashboardSearchResults');
        if (data.success && data.data.length > 0) {
            resultsDiv.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Item ID</th>
                                <th>Name</th>
                                <th>Stock</th>
                                <th>Unit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.data.map(item => `
                                <tr>
                                    <td>${item.item_id}</td>
                                    <td>${item.item_name}</td>
                                    <td>${item.stock}</td>
                                    <td>${item.unit}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            resultsDiv.innerHTML = '<p class="text-muted">No items found</p>';
        }
    })
    .catch(error => {
        console.error('Search error:', error);
        document.getElementById('dashboardSearchResults').innerHTML = '<p class="text-danger">Search failed</p>';
    });
}

function initDashboardCalendar() {
    const calendarDiv = document.getElementById('dashboardCalendar');
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    
    let calendarHTML = `
        <div class="mini-calendar">
            <div class="calendar-header">
                <strong>${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
            </div>
            <div class="calendar-grid">
                <div class="calendar-days">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>
                <div class="calendar-dates">
    `;
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today.getDate() ? 'today' : '';
        calendarHTML += `<div class="calendar-date ${isToday}">${day}</div>`;
    }
    calendarHTML += `
                </div>
            </div>
        </div>
        <style>
            .mini-calendar { font-size: 0.8em; }
            .calendar-header { text-align: center; margin-bottom: 10px; }
            .calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 5px; }
            .calendar-days > div { text-align: center; font-weight: bold; padding: 5px; }
            .calendar-dates { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
            .calendar-date { text-align: center; padding: 5px; cursor: pointer; }
            .calendar-date:hover { background-color: #f0f0f0; }
            .calendar-date.today { background-color: #007bff; color: white; border-radius: 3px; }
        </style>
    `;
    
    calendarDiv.innerHTML = calendarHTML;
}

function showAddUserModal() {
    const modalHtml = `
        <div class="modal fade" id="addUserModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Add New User</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="addUserForm">
                            <div class="mb-3">
                                <label for="newUsername" class="form-label">Username</label>
                                <input type="text" class="form-control" id="newUsername" required>
                            </div>
                            <div class="mb-3">
                                <label for="newPassword" class="form-label">Password</label>
                                <input type="password" class="form-control" id="newPassword" required>
                            </div>
                            <div class="mb-3">
                                <label for="newFullName" class="form-label">Full Name</label>
                                <input type="text" class="form-control" id="newFullName" required>
                            </div>
                            <div class="mb-3">
                                <label for="newRole" class="form-label">Role</label>
                                <select class="form-control" id="newRole" required>
                                    <option value="">Select Role</option>
                                    <option value="admin">Admin</option>
                                    <option value="cs">Customer Service</option>
                                    <option value="user">User</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="newDepartment" class="form-label">Department</label>
                                <input type="text" class="form-control" id="newDepartment" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="createUser()">Create User</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const existingModal = document.getElementById('addUserModal');
    if (existingModal) {
        existingModal.remove();
    }
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

async function createUser() {
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const fullName = document.getElementById('newFullName').value;
    const role = document.getElementById('newRole').value;
    const department = document.getElementById('newDepartment').value;

    if (!username || !password || !fullName || !role || !department) {
        showAlert('Please fill all fields', 'danger');
        return;
    }

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                username,
                password,
                pic_name: fullName,
                role_id: getRoleId(role),
                dept_id: 1 
            })
        });

        const result = await response.json();

        if (response.ok) {
            showAlert('User created successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            fetchUsers(); 
        } else {
            showAlert(result.message || 'Failed to create user', 'danger');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert('Error creating user', 'danger');
    }
}

function getRoleId(role) {
    switch(role.toLowerCase()) {
        case 'admin': return 1;
        case 'cs': return 2;
        case 'user': return 3;
        default: return 3;
    }
}

function editUser(userId) {
    showAlert('Edit user functionality will be implemented', 'info');
}

async function resetPassword(userId) {
    const newPassword = prompt('Enter new password:');
    if (!newPassword) return;

    try {
        const response = await fetch(`/api/users/${userId}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ password: newPassword })
        });

        const result = await response.json();

        if (response.ok) {
            showAlert('Password updated successfully', 'success');
        } else {
            showAlert(result.message || 'Failed to update password', 'danger');
        }
    } catch (error) {
        console.error('Error updating password:', error);
        showAlert('Error updating password', 'danger');
    }
}

function searchItems() {
    console.log('Search items functionality');
}
function initializeItemDropdowns() {
    setTimeout(() => {
        const itemSearchFields = [
            'searchItem',
            'dashboardItemSearch', 
            'itemSearch',
            'searchItemSimple'
        ];
        
        itemSearchFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                setupItemDropdown(field);
            }
        });
    }, 500);
}

function setupItemDropdown(inputElement) {
    const fieldId = inputElement.id;
    const dropdownId = `${fieldId}Dropdown`;
    let dropdown = document.getElementById(dropdownId);
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'dropdown-menu position-absolute w-100';
        dropdown.style.cssText = `
            max-height: 300px;
            overflow-y: auto;
            z-index: 1050;
            display: none;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        inputElement.parentNode.style.position = 'relative';
        inputElement.parentNode.appendChild(dropdown);
    }
    let searchTimeout;
    inputElement.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (searchTerm.length < 2) {
            hideDropdown(dropdown);
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchItemsForDropdown(searchTerm, dropdown, inputElement);
        }, 300);
    });
    inputElement.addEventListener('focus', function() {
        if (this.value.trim().length >= 2) {
            searchItemsForDropdown(this.value.trim(), dropdown, inputElement);
        }
    });
    document.addEventListener('click', function(e) {
        if (!inputElement.contains(e.target) && !dropdown.contains(e.target)) {
            hideDropdown(dropdown);
        }
    });
    inputElement.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.dropdown-item');
        let activeItem = dropdown.querySelector('.dropdown-item.active');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!activeItem) {
                if (items.length > 0) {
                    items[0].classList.add('active');
                }
            } else {
                activeItem.classList.remove('active');
                const nextItem = activeItem.nextElementSibling;
                if (nextItem) {
                    nextItem.classList.add('active');
                } else {
                    items[0].classList.add('active');
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!activeItem) {
                if (items.length > 0) {
                    items[items.length - 1].classList.add('active');
                }
            } else {
                activeItem.classList.remove('active');
                const prevItem = activeItem.previousElementSibling;
                if (prevItem) {
                    prevItem.classList.add('active');
                } else {
                    items[items.length - 1].classList.add('active');
                }
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeItem) {
                activeItem.click();
            }
        } else if (e.key === 'Escape') {
            hideDropdown(dropdown);
        }
    });
}
async function searchItemsForDropdown(searchTerm, dropdown, inputElement) {
    try {
        const response = await fetch(`${API_BASE}/items/search?q=${encodeURIComponent(searchTerm)}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                renderDropdownItems(data.data, dropdown, inputElement);
                showDropdown(dropdown);
            }
        }
    } catch (error) {
        console.error('Dropdown search error:', error);
    }
}
function renderDropdownItems(items, dropdown, inputElement) {
    if (items.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-text text-muted">No items found</div>';
        return;
    }
    
    dropdown.innerHTML = items.map(item => `
        <a href="#" class="dropdown-item" data-item-id="${item.id}" data-item-name="${item.item_name}" data-item-code="${item.item_id}">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${item.item_name}</strong>
                    <br>
                    <small class="text-muted">${item.item_id} | Stock: ${item.stock || 0} ${item.unit || ''}</small>
                </div>
                <div class="text-end">
                    <small class="text-muted">${item.detail || ''}</small>
                </div>
            </div>
        </a>
    `).join('');
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const itemName = this.getAttribute('data-item-name');
            const itemId = this.getAttribute('data-item-id');
            const itemCode = this.getAttribute('data-item-code');
            inputElement.value = itemName;
            inputElement.setAttribute('data-selected-item-id', itemId);
            inputElement.setAttribute('data-selected-item-code', itemCode);
            hideDropdown(dropdown);
            triggerSearchForField(inputElement);
        });
    });
}
function showDropdown(dropdown) {
    dropdown.style.display = 'block';
}
function hideDropdown(dropdown) {
    dropdown.style.display = 'none';
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.remove('active');
    });
}
function triggerSearchForField(inputElement) {
    const fieldId = inputElement.id;
    switch (fieldId) {
        case 'searchItem':
            if (typeof searchItems === 'function') {
                searchItems();
            }
            break;
        case 'dashboardItemSearch':
            if (typeof searchItemFromDashboard === 'function') {
                searchItemFromDashboard();
            }
            break;
        case 'itemSearch':
            if (typeof loadItems === 'function') {
                loadItems();
            }
            break;
        case 'searchItemSimple':
            if (typeof searchItemsSimple === 'function') {
                searchItemsSimple();
            }
            break;
    }
}
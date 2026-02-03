# Alysa Porto - Portfolio Projects

Welcome to my project portfolio repository. This monorepo contains several full-stack web applications demonstrating my skills in Software Engineering, including **Inventory Management**, **Legal Compliance**, and **Financial Tracking**.

## 🚀 Projects Overview

### 1. GAMS 01 (General Affairs Management System)
A comprehensive system for managing general affairs operational requests and inventory.
- **Tech Stack**: Node.js, Express, MySQL (Mock/Cloud), Tailwind CSS.
- **Key Features**:
  - Role-based Dashboard (Admin, User, CS).
  - Inventory & Stock Management with Low Stock Alerts.
  - Request Approval Workflows.
  - Dynamic Department & User Management.

### 2. Legal Web (Compliance System)
A regulatory compliance and document management system for corporate legal requirements.
- **Tech Stack**: Node.js, Express, MySQL (Mock/Cloud).
- **Key Features**:
  - Regulatory Document Library (UU, PP, Perpres, etc.).
  - Compliance Status Tracking (Complied, In Progress, Not Complied).
  - Dynamic Departmental Regulation Tables.
  - Document Import/Export & Review System.

### 3. CashTracking
A personal finance application for tracking income and expenses.
- **Tech Stack**: Python (Flask), React.js, SQLite (In-Memory for Demo).
- **Key Features**:
  - Transaction Recording (Income/Expense).
  - Financial Summary & Reporting.
  - User Authentication (Session-based).
  - *Serverless Ready*: Optimized for Render/Vercel with in-memory database support.

### 4. Healthcare Web
A responsive landing page design for a healthcare service provider.
- **Tech Stack**: HTML5, CSS3, JavaScript.

---

## 🛠️ Deployment

This project is configured for **Automated Deployment** using [Render](https://render.com).

### Deployment Steps:
1. Fork/Clone this repository.
2. Sign up on Render and create a new **Blueprint**.
3. Connect your repository.
4. Render will automatically detect the `render.yaml` configuration and deploy:
   - `gams-01` (Node.js Service)
   - `legal-web` (Node.js Service)
   - `cashtracking` (Python Service)

### Configuration (`render.yaml`)
The `render.yaml` file in the root directory manages the build and start commands for all services, ensuring they run correctly in a serverless/containerized environment.

---

## 💻 Local Development

To run these projects locally:

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- Git

### Running GAMS 01
```bash
cd "GAMS 01"
npm install
npm start
# Server runs on http://localhost:3001
```

### Running Legal Web
```bash
cd "Legal web/backend"
npm install
npm start
# Server runs on http://localhost:3009
```

### Running CashTracking
**Backend:**
```bash
cd "CashTracking/backend"
pip install -r requirements.txt
python app.py
# Server runs on http://localhost:4000
```
**Frontend:**
The frontend is served statically by the Flask backend in production, but for development:
```bash
cd "CashTracking/frontend"
npm install
npm start
```

---

## 👤 Author
**Alysa Hanel**
*Software Engineering Portfolio*

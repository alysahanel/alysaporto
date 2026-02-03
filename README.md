# Alysa Porto - Portfolio Projects

Welcome to my project portfolio repository. This monorepo contains several full-stack web applications demonstrating my skills in Software Engineering, including **Inventory Management**, **Legal Compliance**, and **Financial Tracking**.

Projects Overview

### 1. Alysa Milano Management System
A comprehensive system for managing  operational requests and inventory.
- **Tech Stack**: Node.js, Express, MySQL (Mock/Cloud), Tailwind CSS.
- **Key Features**:
  - Role-based Dashboard (Admin, User, CS).
  - Inventory & Stock Management with Low Stock Alerts.
  - Request Approval Workflows.
  - Dynamic Department & User Management.

### 2. Alysa Milano Compliance System
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

### Running GAMS 01
```bash
cd "gams-01"
npm install
npm start
# Server runs on http://localhost:3001
```

### Running Legal Web
```bash
cd "legal-web/backend"
npm install
npm start
# Server runs on http://localhost:3009
```

## 🛠️ Deployment

This project is configured for deployment on **Vercel** (Recommended for free tier without credit card) or **Render**.

### Option 1: Vercel (Recommended)
1. Fork/Clone this repository to your GitHub.
2. Log in to [Vercel](https://vercel.com) using GitHub.
3. Click **"Add New Project"** and select this repository.
4. Vercel will automatically detect the `vercel.json` configuration.
5. Click **Deploy**.

### Option 2: Render
1. Sign up on Render and create a new **Blueprint**.
2. Connect your repository.
3. Render will automatically detect the `render.yaml` configuration.
4. Apply the blueprint.

### Configuration Files
- `vercel.json`: Configuration for Vercel (Serverless Functions).
- `render.yaml`: Configuration for Render (Docker/Native Services).



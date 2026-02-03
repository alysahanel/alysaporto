const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// Serve static files from root for index.html and portfolio assets
app.use(express.static(path.join(__dirname), {
    index: false // We will handle index explicitly
}));

// Route for the main portfolio
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- GAMS 01 Rewrites ---
// Proxy API to running backend
app.use('/gams/api', createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: {
        '^/gams': '', // /gams/api/x -> /api/x (if backend is at /api)
    },
    onError: (err, req, res) => {
        res.status(502).send('GAMS Backend (Port 3001) not running.');
    }
}));

// Unified proxy for absolute '/api' calls from sub-project pages
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    router: (req) => {
        const u = req.url || '';
        if (/^\/api\/(company|operational|safety|license-permit|regulatory|elibrary)/.test(u)) {
            return 'http://localhost:3009';
        }
        return 'http://localhost:3001';
    }
}));

// Serve GAMS Frontend
app.use('/gams', express.static(path.join(__dirname, 'GAMS 01/public'), {
    index: 'login.html' // Default to login page
}));

// Map root-level routes used by GAMS pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'GAMS 01/public', 'login.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'GAMS 01/public', 'dashboard.html'));
});
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'dashboard.html'));
});
app.get('/requests', (req, res) => {
    res.sendFile(path.join(__dirname, 'GAMS 01/public', 'requests.html'));
});
app.get('/stock', (req, res) => {
    res.sendFile(path.join(__dirname, 'GAMS 01/public', 'stock.html'));
});
app.get('/calendar', (req, res) => {
    res.sendFile(path.join(__dirname, 'GAMS 01/public', 'calendar.html'));
});
app.get('/accounts', (req, res) => {
    res.sendFile(path.join(__dirname, 'GAMS 01/public', 'accounts.html'));
});
app.get('/stock-report', (req, res) => {
    res.sendFile(path.join(__dirname, 'GAMS 01/public', 'stock-report.html'));
});

// --- Legal Web Rewrites ---
// Proxy API to running backend
app.use('/legal/api', createProxyMiddleware({
    target: 'http://localhost:3009',
    changeOrigin: true,
    pathRewrite: {
        '^/legal': '', // /legal/api/x -> /api/x
    },
    onError: (err, req, res) => {
        res.status(502).send('Legal Web Backend (Port 3009) not running.');
    }
}));

// Serve Legal Web Frontend
app.use('/legal', express.static(path.join(__dirname, 'Legal web/frontend/public'), {
    index: 'dashboard.html' // Default to dashboard
}));

// Support absolute '/assets' for Legal Web pages that reference root paths
app.use('/assets', express.static(path.join(__dirname, 'Legal web/frontend/public/assets')));

// Map common Legal Web friendly routes to static files
app.get('/legal/license-permit', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'license-permit.html'));
});
app.get('/legal/regulatory', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'regulatory.html'));
});
app.get('/legal/elibrary', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'elibrary.html'));
});
app.get('/legal/operational', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'operational.html'));
});
app.get('/legal/company', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'company.html'));
});
app.get('/legal/safety', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'safety.html'));
});

// Root routes mapping to Legal Web pages for absolute navigations
app.get('/license-permit', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'license-permit.html'));
});
app.get('/license-permit.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'license-permit.html'));
});
app.get('/company', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'company.html'));
});
app.get('/company.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'company.html'));
});
app.get('/operational', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'operational.html'));
});
app.get('/operational.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'operational.html'));
});
app.get('/safety', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'safety.html'));
});
app.get('/safety.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'safety.html'));
});
app.get('/regulatory', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'regulatory.html'));
});
app.get('/regulatory.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'regulatory.html'));
});
app.get('/elibrary', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'elibrary.html'));
});
app.get('/elibrary.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Legal web/frontend/public', 'elibrary.html'));
});

// --- CashTracking Rewrites ---
// Proxy API to running backend
app.use('/cashtracking/api', createProxyMiddleware({
    target: 'http://localhost:4000',
    changeOrigin: true,
    pathRewrite: {
        '^/cashtracking/api': '', // /cashtracking/api/transactions -> /transactions
    },
    onError: (err, req, res) => {
        res.status(502).send('CashTracking Backend (Port 4000) not running.');
    }
}));

// Serve CashTracking Frontend (React Build)
app.use('/cashtracking', express.static(path.join(__dirname, 'CashTracking/frontend/build')));

// Handle React Client-Side Routing for CashTracking
app.get('/cashtracking/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'CashTracking/frontend/build/index.html'));
});

// --- Healthcare Web Rewrites ---
app.use('/healthcare', express.static(path.join(__dirname, 'Healthcare Web')));


app.listen(PORT, () => {
    console.log(`\n🚀 Portfolio Server running at http://localhost:${PORT}`);
    console.log(`\nSub-projects available at:`);
    console.log(`- GAMS: http://localhost:${PORT}/gams`);
    console.log(`- Legal: http://localhost:${PORT}/legal`);
    console.log(`- CashTracking: http://localhost:${PORT}/cashtracking`);
    console.log(`- Healthcare: http://localhost:${PORT}/healthcare`);
    console.log(`\n⚠️  Ensure backends are running on ports 3001, 3009, 4000 for full functionality.`);
});

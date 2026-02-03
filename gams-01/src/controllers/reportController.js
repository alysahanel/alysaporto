const { pool } = require('../config/database');

const getStockReport = async (req, res) => {
    try {
        const { startDate, endDate, status, department, itemId } = req.query;
        
        let query = `
            SELECT 
                sr.transaction_date,
                sr.item_id,
                i.item_name,
                sr.initial_stock,
                sr.quantity,
                sr.unit,
                sr.process_status,
                sr.process_date,
                sr.department,
                sr.pic,
                sr.requesting_department,
                sr.receiver,
                sr.created_at
            FROM stock_reports sr
            LEFT JOIN items i ON sr.item_id = i.item_id
            WHERE 1=1
        `;
        
        const queryParams = [];
        
        if (startDate) {
            query += ' AND sr.transaction_date >= ?';
            queryParams.push(startDate);
        }
        
        if (endDate) {
            query += ' AND sr.transaction_date <= ?';
            queryParams.push(endDate);
        }
        
        if (status) {
            query += ' AND sr.process_status = ?';
            queryParams.push(status);
        }
        
        if (department) {
            query += ' AND sr.department = ?';
            queryParams.push(department);
        }
        
        if (itemId) {
            query += ' AND sr.item_id = ?';
            queryParams.push(itemId);
        }
        
        query += ' ORDER BY sr.transaction_date DESC, sr.created_at DESC';
        
        const [rows] = await pool.execute(query, queryParams);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const createStockReport = async (req, res) => {
    try {
        const {
            transaction_date,
            item_id,
            initial_stock,
            quantity,
            unit,
            process_status,
            process_date,
            department,
            pic,
            requesting_department,
            receiver
        } = req.body;
        
        if (!transaction_date || !item_id || !quantity || !process_status) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        const query = `
            INSERT INTO stock_reports (
                transaction_date, item_id, initial_stock, quantity, unit,
                process_status, process_date, department, pic,
                requesting_department, receiver, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        const [result] = await pool.execute(query, [
            transaction_date,
            item_id,
            initial_stock || 0,
            quantity,
            unit || 'Pcs',
            process_status,
            process_date || transaction_date,
            department,
            pic,
            requesting_department,
            receiver
        ]);
        
        res.status(201).json({
            success: true,
            message: 'Stock report entry created successfully',
            data: {
                id: result.insertId,
                transaction_date,
                item_id,
                quantity,
                process_status
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateStockReport = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            transaction_date,
            item_id,
            initial_stock,
            quantity,
            unit,
            process_status,
            process_date,
            department,
            pic,
            requesting_department,
            receiver
        } = req.body;
        
        const [existing] = await pool.execute(
            'SELECT id FROM stock_reports WHERE id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Stock report not found'
            });
        }
        
        const query = `
            UPDATE stock_reports SET
                transaction_date = ?,
                item_id = ?,
                initial_stock = ?,
                quantity = ?,
                unit = ?,
                process_status = ?,
                process_date = ?,
                department = ?,
                pic = ?,
                requesting_department = ?,
                receiver = ?,
                updated_at = NOW()
            WHERE id = ?
        `;
        
        await pool.execute(query, [
            transaction_date,
            item_id,
            initial_stock,
            quantity,
            unit,
            process_status,
            process_date,
            department,
            pic,
            requesting_department,
            receiver,
            id
        ]);
        
        res.json({
            success: true,
            message: 'Stock report updated successfully'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteStockReport = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [existing] = await pool.execute(
            'SELECT id FROM stock_reports WHERE id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Stock report not found'
            });
        }
        
        await pool.execute('DELETE FROM stock_reports WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Stock report deleted successfully'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getReportStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = '';
        const queryParams = [];
        
        if (startDate && endDate) {
            dateFilter = 'WHERE transaction_date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }
        
        const statusQuery = `
            SELECT 
                process_status,
                COUNT(*) as count,
                SUM(quantity) as total_quantity
            FROM stock_reports 
            ${dateFilter}
            GROUP BY process_status
        `;
        
        const deptQuery = `
            SELECT 
                department,
                COUNT(*) as transaction_count,
                SUM(quantity) as total_items
            FROM stock_reports 
            ${dateFilter}
            GROUP BY department
            ORDER BY transaction_count DESC
            LIMIT 10
        `;
        
        const itemsQuery = `
            SELECT 
                sr.item_id,
                i.item_name,
                COUNT(*) as transaction_count,
                SUM(sr.quantity) as total_quantity
            FROM stock_reports sr
            LEFT JOIN items i ON sr.item_id = i.item_id
            ${dateFilter}
            GROUP BY sr.item_id, i.item_name
            ORDER BY transaction_count DESC
            LIMIT 10
        `;
        
        const [statusStats] = await pool.execute(statusQuery, queryParams);
        const [deptStats] = await pool.execute(deptQuery, queryParams);
        const [itemStats] = await pool.execute(itemsQuery, queryParams);
        
        res.json({
            success: true,
            data: {
                statusStats,
                departmentStats: deptStats,
                topItems: itemStats
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getStockReport,
    createStockReport,
    updateStockReport,
    deleteStockReport,
    getReportStats
};

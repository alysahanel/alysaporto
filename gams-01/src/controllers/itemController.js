const itemModel = require('../models/itemModel');
const { generateNextItemId, validateItemIdFormat, itemIdExists } = require('../utils/itemIdGenerator');
const { pool } = require('../config/database');

class ItemController {
  async getAllItems(req, res) {
    try {
      const { search, category } = req.query;
      const filters = {};
      
      if (search) filters.search = search;
      if (category) filters.category = category;
      
      const items = await itemModel.getAllItems(filters);
      
      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil data item'
      });
    }
  }

  async getItemById(req, res) {
    try {
      const { id } = req.params;
      const item = await itemModel.getItemById(id);
      
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Item tidak ditemukan'
        });
      }
      
      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil data item'
      });
    }
  }

  async createItem(req, res) {
    try {
      const { item_id, item_name, detail, unit, stock, min_stock } = req.body;
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }
      
      if (!['admin', 'cs'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only admin and CS can create items'
        });
      }
      
      if (!item_name || !unit) {
        return res.status(400).json({
          success: false,
          message: 'Item name and unit are required'
        });
      }
      
      let finalItemId;
      
      if (item_id) {
        if (!validateItemIdFormat(item_id)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid item ID format. Use GA-XXXX format or custom format (3-50 characters)'
          });
        }
        
        if (await itemIdExists(item_id)) {
          return res.status(400).json({
            success: false,
            message: 'Item ID already exists. Please use a different ID.'
          });
        }
        
        finalItemId = item_id;
      } else {
        finalItemId = await generateNextItemId();
      }
      
      const itemData = {
        item_id: finalItemId,
        item_name,
        detail: detail || '',
        unit,
        stock: stock || 0,
        min_stock: min_stock || 10
      };
      
      const newItemId = await itemModel.createItem(itemData);
      try {
        const transactionId = 'TXN' + Date.now();
        const processDate = new Date();
        const initialQty = stock || 0;
        await pool.execute(
          'INSERT INTO stock_transactions (transaction_id, item_id, qty, type, process, process_date, department, pic, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            transactionId,
            newItemId,
            initialQty,
            'in',
            'New Item Created',
            processDate,
            user.department || null,
            user.username || null,
            user.id
          ]
        );
      } catch (txErr) {}

      res.status(201).json({
        success: true,
        message: 'Item created successfully',
        data: { id: newItemId, item_id: finalItemId }
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Item ID already exists'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create item'
      });
    }
  }

  async updateItem(req, res) {
    try {
      const { id } = req.params;
      const { item_id, item_name, detail, unit, min_stock } = req.body;
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admin can edit item details' });
      }
      
      if (item_id) {
        if (!validateItemIdFormat(item_id)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid item ID format. Use GA-XXXX format or custom format (3-50 characters)'
          });
        }
        
        const [existingItem] = await pool.execute(
          'SELECT id FROM items WHERE item_id = ? AND id != ?',
          [item_id, id]
        );
        
        if (existingItem.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Item ID already exists. Please use a different ID.'
          });
        }
      }
      
      const itemData = {
        item_id,
        item_name,
        detail,
        unit,
        min_stock
      };
      
      const updated = await itemModel.updateItem(id, itemData);
      
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Item tidak ditemukan'
        });
      }
      
      res.json({
        success: true,
        message: 'Item berhasil diupdate'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Gagal mengupdate item'
      });
    }
  }

  async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { stock, operation } = req.body;
      
      if (!stock || !operation) {
        return res.status(400).json({
          success: false,
          message: 'Stock dan operation harus diisi'
        });
      }
      
      const updated = await itemModel.updateStock(id, stock, operation);
      
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Item tidak ditemukan'
        });
      }
      
      res.json({
        success: true,
        message: 'Stock berhasil diupdate'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Gagal mengupdate stock'
      });
    }
  }

  async getStockReport(req, res) {
    try {
      const { startDate, endDate, itemId } = req.query;
      const filters = {};
      
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (itemId) filters.itemId = itemId;
      
      const report = await itemModel.getStockReport(filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil laporan stock'
      });
    }
  }

  async getLowStockItems(req, res) {
    try {
      const items = await itemModel.getLowStockItems();
      
      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil data item stock rendah'
      });
    }
  }

  async searchItems(req, res) {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Query pencarian harus diisi'
        });
      }
      
      const items = await itemModel.searchItems(q);
      
      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Gagal mencari item'
      });
    }
  }

  async deleteItem(req, res) {
    try {
      const { id } = req.params;
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (!['admin', 'cs'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only admin and CS can delete items'
        });
      }

      const item = await itemModel.getItemById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Item tidak ditemukan'
        });
      }

      const fullItem = await itemModel.getItemById(id);
      const currentStock = fullItem?.stock || 0;

      try {
        const transactionId = 'TXN' + Date.now();
        await pool.execute(
          'INSERT INTO stock_transactions (transaction_id, item_id, qty, type, process, process_date, department, pic, created_by) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)',
          [
            transactionId,
            id,
            currentStock,
            'out',
            'Item Deleted',
            user.department || null,
            user.username || null,
            user.id
          ]
        );
      } catch (txErr) {}

      const deleted = await itemModel.deleteItem(id);
      
      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: 'Gagal menghapus item'
        });
      }

      res.json({
        success: true,
        message: 'Item berhasil dihapus'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Gagal menghapus item'
      });
    }
  }
}

module.exports = new ItemController();

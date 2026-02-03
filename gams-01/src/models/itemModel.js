const { pool } = require('../config/database');

class ItemModel {
  async getAllItems(filters = {}) {
    try {
      let query = 'SELECT * FROM items WHERE (is_deleted IS NULL OR is_deleted = 0)';
      const params = [];
      
      if (filters.search) {
        query += ' AND (item_name LIKE ? OR detail LIKE ? OR item_id LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }
      
      if (filters.category) {
        query += ' AND category = ?';
        params.push(filters.category);
      }
      
      query += ' ORDER BY item_name';
      
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error getting all items:', error);
      throw error;
    }
  }
  async getItemById(id) {
    try {
      const [rows] = await pool.execute('SELECT * FROM items WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)', [id]);
      return rows[0];
    } catch (error) {
      console.error('Error getting item by ID:', error);
      throw error;
    }
  }
  async searchItems(searchTerm) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM items WHERE (is_deleted IS NULL OR is_deleted = 0) AND (item_name LIKE ? OR item_id LIKE ?) ORDER BY item_name',
        [`%${searchTerm}%`, `%${searchTerm}%`]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
  async createItem(itemData) {
    try {
      const { item_id, item_name, detail, stock, unit, min_stock } = itemData;
      
      const [result] = await pool.execute(
        'INSERT INTO items (item_id, item_name, detail, stock, unit, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
        [item_id, item_name, detail, stock || 0, unit, min_stock || 0]
      );
      
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }
  async updateStock(itemId, quantity, userId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      await connection.execute(
        'UPDATE items SET stock = stock + ? WHERE id = ?',
        [quantity, itemId]
      );
      await connection.execute(
        'INSERT INTO stock_transactions (item_id, qty, process, user_id) VALUES (?, ?, ?, ?)',
        [itemId, quantity, 'in', userId]
      );
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Error updating stock:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  async addStock(itemId, quantity, transactionData) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      await connection.execute(
        'UPDATE items SET stock = stock + ? WHERE id = ?',
        [quantity, itemId]
      );
      await connection.execute(
        'INSERT INTO stock_transactions (item_id, quantity, transaction_type, reference_type, created_by) VALUES (?, ?, ?, ?, ?)',
        [itemId, quantity, 'in', 'adjustment', transactionData.user_id]
      );
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Error adding stock:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  async reduceStock(itemId, quantity, transactionData) {
    const connection = await pool.getConnection();
     
    try {
      await connection.beginTransaction();
      const [items] = await connection.execute(
        'SELECT stock FROM items WHERE id = ?',
        [itemId]
      );
      
      if (items.length === 0) {
        throw new Error('Item tidak ditemukan');
      }
      
      if (items[0].stock < quantity) {
        throw new Error('Stok tidak mencukupi');
      }
      await connection.execute(
        'UPDATE items SET stock = stock - ? WHERE id = ?',
        [quantity, itemId]
      );
      await connection.execute(
        'INSERT INTO stock_transactions (item_id, quantity, transaction_type, reference_type, created_by) VALUES (?, ?, ?, ?, ?)',
        [itemId, quantity, 'out', 'adjustment', transactionData.user_id]
      );
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Error reducing stock:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  async updateItem(id, itemData) {
    try {
      const { item_id, item_name, detail, unit, min_stock } = itemData;
      const fields = [];
      const values = [];
      
      if (item_id !== undefined) {
        fields.push('item_id = ?');
        values.push(item_id);
      }
      if (item_name !== undefined) {
        fields.push('item_name = ?');
        values.push(item_name);
      }
      if (detail !== undefined) {
        fields.push('detail = ?');
        values.push(detail);
      }
      if (unit !== undefined) {
        fields.push('unit = ?');
        values.push(unit);
      }
      if (min_stock !== undefined) {
        fields.push('min_stock = ?');
        values.push(min_stock);
      }
      
      if (fields.length === 0) {
        return false; 
      }
      values.push(id);

      const query = `UPDATE items SET ${fields.join(', ')} WHERE id = ?`;
      const [result] = await pool.execute(query, values);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  }
  async deleteItem(id) {
    const connection = await pool.getConnection();
    
    try {

      await connection.beginTransaction();
      const [result] = await connection.execute(
        'UPDATE items SET is_deleted = 1, stock = 0, updated_at = NOW(), deleted_at = NOW() WHERE id = ?',
        [id]
      );
      await connection.commit();
      
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting item:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async getLowStockItems() {
    try {
      const [rows] = await pool.execute(`
        SELECT * FROM items 
        WHERE (is_deleted IS NULL OR is_deleted = 0) AND stock <= min_stock AND min_stock > 0
        ORDER BY (stock / min_stock) ASC
      `);
      return rows;
    } catch (error) {
      console.error('Error getting low stock items:', error);
      throw error;
    }
  }
  
  async getItemStats() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          COUNT(CASE WHEN is_deleted IS NULL OR is_deleted = 0 THEN 1 END) as total_items,
          SUM(CASE WHEN is_deleted IS NULL OR is_deleted = 0 THEN stock ELSE 0 END) as total_stock,
          COUNT(CASE WHEN (is_deleted IS NULL OR is_deleted = 0) AND stock <= min_stock AND min_stock > 0 THEN 1 END) as low_stock_items,
          COUNT(CASE WHEN (is_deleted IS NULL OR is_deleted = 0) AND stock = 0 THEN 1 END) as out_of_stock_items
        FROM items
      `);
      return rows[0];
    } catch (error) {
      console.error('Error getting item stats:', error);
      throw error;
    }
  }
}

module.exports = new ItemModel();
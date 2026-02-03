const { pool } = require('../config/database');

class CalendarModel {
  async getAllEvents() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          ce.*,
          u.pic_name as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        ORDER BY ce.event_date, ce.event_time
      `);
      return rows;
    } catch (error) {
      throw error;
    }
  }
  async getEventById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          ce.*,
          u.pic_name as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.id = ?
      `, [id]);
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  }
  async getEventsByDate(date) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          ce.*,
          u.pic_name as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.event_date = ?
        ORDER BY ce.event_time
      `, [date]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }
  async getEventsByDateRange(startDate, endDate) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          ce.*,
          u.pic_name as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.event_date BETWEEN ? AND ?
        ORDER BY ce.event_date, ce.event_time
      `, [startDate, endDate]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }
  async createEvent(eventData) {
    try {
      const { title, description, event_date, event_time, created_by } = eventData;
      
      const [result] = await pool.execute(
        'INSERT INTO calendar_events (title, description, event_date, event_time, created_by) VALUES (?, ?, ?, ?, ?)',
        [title, description, event_date, event_time, created_by]
      );
      
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }
  async updateEvent(id, eventData) {
    try {
      const { title, description, event_date, event_time } = eventData;
      
      const [result] = await pool.execute(
        'UPDATE calendar_events SET title = ?, description = ?, event_date = ?, event_time = ? WHERE id = ?',
        [title, description, event_date, event_time, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
  async deleteEvent(eventId) {
    try {
      const [result] = await pool.execute('DELETE FROM calendar_events WHERE id = ?', [eventId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
  async getEventsByUser(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          ce.*,
          u.pic_name as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.created_by = ?
        ORDER BY ce.event_date, ce.event_time
      `, [userId]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }
  async getTodayEvents() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [rows] = await pool.execute(`
        SELECT 
          ce.*,
          u.pic_name as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.event_date = ?
        ORDER BY ce.event_time
      `, [today]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }
  async getThisWeekEvents() {
    try {
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
      
      const startDate = startOfWeek.toISOString().split('T')[0];
      const endDate = endOfWeek.toISOString().split('T')[0];
      
      const [rows] = await pool.execute(`
        SELECT 
          ce.*,
          u.pic_name as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.event_date BETWEEN ? AND ?
        ORDER BY ce.event_date, ce.event_time
      `, [startDate, endDate]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CalendarModel();
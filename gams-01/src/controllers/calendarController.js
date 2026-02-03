const { pool } = require('../config/database');

class CalendarController {
  static async getAllEvents(req, res) {
    try {
      const [events] = await pool.execute(`
        SELECT ce.*, u.username as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        ORDER BY ce.event_date ASC, ce.event_time ASC
      `);

      res.json({ success: true, data: events });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getEventsByDate(req, res) {
    try {
      const { date } = req.params;
      const [events] = await pool.execute(`
        SELECT ce.*, u.username as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.event_date = ?
        ORDER BY ce.event_time ASC
      `, [date]);

      res.json({ success: true, data: events });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async createEvent(req, res) {
    try {
      const { event_date, start_time, end_time, event_time, title, description, location } = req.body;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const userRole = user.role;

      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can create events' });
      }
      
      if (!event_date || !title) {
        return res.status(400).json({ success: false, message: 'Event date and title are required' });
      }

      const [result] = await pool.execute(`
        INSERT INTO calendar_events (event_date, event_time, title, description, location, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [event_date, (event_time || start_time) || null, title, description || null, location || null, user.id]);

      const [newEvent] = await pool.execute(`
        SELECT ce.*, u.username as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.id = ?
      `, [result.insertId]);

      res.json({ success: true, data: newEvent[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async updateEvent(req, res) {
    try {
      const { id } = req.params;
      const { event_date, start_time, end_time, event_time, title, description, location } = req.body;
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const userRole = user.role;

      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can update events' });
      }

      if (!event_date || !title) {
        return res.status(400).json({ success: false, message: 'Event date and title are required' });
      }

      const [result] = await pool.execute(`
        UPDATE calendar_events 
        SET event_date = ?, event_time = ?, title = ?, description = ?, location = ?, updated_at = NOW()
        WHERE id = ?
      `, [event_date, (event_time || start_time) || null, title, description || null, location || null, id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      const [updatedEvent] = await pool.execute(`
        SELECT ce.*, u.username as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.id = ?
      `, [id]);

      res.json({ success: true, data: updatedEvent[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const userRole = user.role;

      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can delete events' });
      }

      const [result] = await pool.execute('DELETE FROM calendar_events WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getTodayEvents(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [events] = await pool.execute(`
        SELECT ce.*, u.username as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.event_date = ?
        ORDER BY ce.event_time ASC
      `, [today]);

      res.json({ success: true, data: events });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getThisWeekEvents(req, res) {
    try {
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
      
      const startDate = startOfWeek.toISOString().split('T')[0];
      const endDate = endOfWeek.toISOString().split('T')[0];

      const [events] = await pool.execute(`
        SELECT ce.*, u.username as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.event_date BETWEEN ? AND ?
        ORDER BY ce.event_date ASC, ce.event_time ASC
      `, [startDate, endDate]);

      res.json({ success: true, data: events });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getEventsByDateRange(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Start date and end date are required' });
      }

      const [events] = await pool.execute(`
        SELECT ce.*, u.username as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.event_date BETWEEN ? AND ?
        ORDER BY ce.event_date ASC, ce.event_time ASC
      `, [startDate, endDate]);

      res.json({ success: true, data: events });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getEventById(req, res) {
    try {
      const { id } = req.params;

      const [events] = await pool.execute(`
        SELECT ce.*, u.username as created_by_name
        FROM calendar_events ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.id = ?
      `, [id]);

      if (events.length === 0) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      res.json({ success: true, data: events[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = CalendarController;

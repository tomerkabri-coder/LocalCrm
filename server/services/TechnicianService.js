const db = require('../db');
const Utils = require('../utils');

const TechnicianService = {
  getAll() {
    return db.read('technicians');
  },

  getById(id) {
    return db.findOne('technicians', t => String(t.tech_id).toUpperCase() === String(id).toUpperCase());
  },

  save(tech) {
    if (!tech.tech_id) {
      tech.tech_id = "T" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
      return db.insert('technicians', tech);
    } else {
      return db.update('technicians', t => t.tech_id === tech.tech_id, tech);
    }
  },

  delete(id) {
    return db.remove('technicians', t => t.tech_id === id);
  },

  updateLocation(id, lat, lng) {
    return db.update('technicians', t => String(t.tech_id).toUpperCase() === String(id).toUpperCase(), {
      current_lat: lat,
      current_lng: lng,
      last_location_update: new Date().toISOString()
    });
  },

  updateStatus(id, isActive) {
    return db.update('technicians', t => String(t.tech_id).toUpperCase() === String(id).toUpperCase(), {
      is_active: isActive,
      last_update: new Date().toISOString()
    });
  }
};

module.exports = TechnicianService;

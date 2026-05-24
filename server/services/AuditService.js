const db = require('../db');

const AuditService = {
  getAll() { return db.read('assignments_log'); },
  log(action, details) {
    return db.insert('assignments_log', {
      timestamp: new Date().toISOString(),
      action,
      details
    });
  }
};

module.exports = AuditService;

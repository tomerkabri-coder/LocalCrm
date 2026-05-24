const db = require('../db');

const NotificationService = {
  getAll() { return db.read('notifications'); },
  add(recipient, message, type = 'SMS') {
    return db.insert('notifications', {
      timestamp: new Date().toISOString(),
      recipient,
      message,
      type
    });
  }
};

module.exports = NotificationService;

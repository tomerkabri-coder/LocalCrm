const db = require('../db');

const SettingsService = {
  get() { return db.read('settings'); },
  save(settings) {
    db.write('settings', settings);
    return settings;
  }
};

module.exports = SettingsService;

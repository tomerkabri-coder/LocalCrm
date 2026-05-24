const db = require('../db');
const Utils = require('../utils');

const InventoryService = {
  getAll() { return db.read('inventory'); },
  save(part) {
    if (!part.part_id) {
      part.part_id = "P" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
      return db.insert('inventory', part);
    }
    return db.update('inventory', p => p.part_id === part.part_id, part);
  },
  delete(id) { return db.remove('inventory', p => p.part_id === id); }
};

module.exports = InventoryService;

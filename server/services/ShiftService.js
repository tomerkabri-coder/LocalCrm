const db = require('../db');
const Utils = require('../utils');

const ShiftService = {
  getAll() { return db.read('shifts'); },
  save(shift) {
    if (!shift.shift_id) {
      shift.shift_id = "S" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
      return db.insert('shifts', shift);
    }
    return db.update('shifts', s => s.shift_id === shift.shift_id, shift);
  },
  delete(id) { return db.remove('shifts', s => s.shift_id === id); }
};

module.exports = ShiftService;

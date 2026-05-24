const db = require('../db');
const Utils = require('../utils');

const FleetService = {
  getAll() { return db.read('fleet'); },
  save(vehicle) {
    if (!vehicle.vehicle_id) {
      vehicle.vehicle_id = "V" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
      return db.insert('fleet', vehicle);
    }
    return db.update('fleet', v => v.vehicle_id === vehicle.vehicle_id, vehicle);
  },
  delete(id) { return db.remove('fleet', v => v.vehicle_id === id); }
};

module.exports = FleetService;

const fs = require('fs');
const path = require('path');

class JsonDatabase {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePaths = {
      calls: path.join(dataDir, 'calls.json'),
      technicians: path.join(dataDir, 'technicians.json'),
      customers: path.join(dataDir, 'customers.json'),
      shifts: path.join(dataDir, 'shifts.json'),
      fleet: path.join(dataDir, 'fleet.json'),
      settings: path.join(dataDir, 'settings.json'),
      inventory: path.join(dataDir, 'inventory.json'),
      notifications: path.join(dataDir, 'notifications.json'),
      assignments_log: path.join(dataDir, 'assignments_log.json')
    };
    this.init();
  }

  init() {
    Object.values(this.filePaths).forEach(filePath => {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]');
      }
    });
  }

  read(entity) {
    const filePath = this.filePaths[entity];
    if (!filePath) throw new Error(`Unknown entity: ${entity}`);
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${entity}:`, error);
      return [];
    }
  }

  write(entity, data) {
    const filePath = this.filePaths[entity];
    if (!filePath) throw new Error(`Unknown entity: ${entity}`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Error writing ${entity}:`, error);
      return false;
    }
  }

  findOne(entity, predicate) {
    const data = this.read(entity);
    return data.find(predicate);
  }

  findAll(entity, predicate) {
    const data = this.read(entity);
    return predicate ? data.filter(predicate) : data;
  }

  insert(entity, item) {
    const data = this.read(entity);
    data.push(item);
    this.write(entity, data);
    return item;
  }

  update(entity, predicate, updates) {
    const data = this.read(entity);
    const index = data.findIndex(predicate);
    if (index === -1) return null;

    data[index] = { ...data[index], ...updates };
    this.write(entity, data);
    return data[index];
  }

  remove(entity, predicate) {
    const data = this.read(entity);
    const filtered = data.filter(item => !predicate(item));
    this.write(entity, filtered);
    return true;
  }
}

module.exports = new JsonDatabase(path.join(__dirname, '../data'));

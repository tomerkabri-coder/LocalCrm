const db = require('../db');
const Utils = require('../utils');

const CustomerService = {
  getAll() {
    return db.read('customers');
  },

  getById(id) {
    return db.findOne('customers', c => c.customer_id === id);
  },

  getOrCreate(data) {
    let customer = db.findOne('customers', c => 
      String(c.phone) === String(data.phone) || 
      (data.email && String(c.email) === String(data.email))
    );

    if (customer) return customer;

    const customerId = "CU" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
    customer = {
      customer_id: customerId,
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      phone: data.phone || "",
      email: data.email || "",
      address: data.address || "",
      vehicle_details: data.vehicle_details || ""
    };
    
    db.insert('customers', customer);
    return customer;
  },

  save(customer) {
    if (!customer.customer_id) {
      return this.getOrCreate(customer);
    } else {
      return db.update('customers', c => c.customer_id === customer.customer_id, customer);
    }
  },

  delete(id) {
    return db.remove('customers', c => c.customer_id === id);
  }
};

module.exports = CustomerService;

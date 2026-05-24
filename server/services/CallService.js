const db = require('../db');
const Utils = require('../utils');
const Scheduling = require('../scheduling');

const CallService = {
  getAll() {
    return db.read('calls');
  },

  getById(id) {
    return db.findOne('calls', c => c.call_id === id);
  },

  create(data) {
    const callId = "C" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
    const priority = data.priority || 4;
    const surcharge = Utils.calculateSurcharge(priority);
    
    // We assume getOrCreateCustomer is handled outside or passed in
    const customerId = data.customer_id;

    const newCall = {
      call_id: callId,
      created_at: new Date().toISOString(),
      customer_id: customerId,
      door_class: data.door_class || "",
      door_type: data.door_type || "",
      priority: priority,
      lat: data.lat,
      lng: data.lng,
      address: data.address,
      assigned_technician: "",
      status: "NEW",
      scheduled_time: data.scheduled_time || "",
      eta: "",
      deposit_paid: 0,
      surcharge_amount: surcharge,
      total_amount: 0,
      recording_url: "",
      before_photo: "",
      after_photo: "",
      sticker_placed: false,
      notes: data.notes || "",
      door_specs: data.door_specs || {}
    };

    db.insert('calls', newCall);
    Scheduling.assignTechnician(callId);
    return newCall;
  },

  update(id, updates) {
    const call = db.findOne('calls', c => c.call_id === id);
    if (!call) throw new Error("Call not found");

    const updated = db.update('calls', c => c.call_id === id, updates);
    return updated;
  },

  updateStatus(id, status, updates = {}) {
    const call = db.findOne('calls', c => c.call_id === id);
    if (!call) throw new Error("Call not found");

    // Handle photos if present (moved from index.js)
    if (updates.before_photo && updates.before_photo.startsWith('data:image')) {
      updates.before_photo = Utils.saveFileLocally(updates.before_photo, `before_${id}.jpg`);
    }
    if (updates.measure_photo && updates.measure_photo.startsWith('data:image')) {
      updates.measure_photo = Utils.saveFileLocally(updates.measure_photo, `measure_${id}.jpg`);
    }
    if (updates.after_photo && updates.after_photo.startsWith('data:image')) {
      updates.after_photo = Utils.saveFileLocally(updates.after_photo, `after_${id}.jpg`);
    }

    const updatedCall = db.update('calls', c => c.call_id === id, {
      status,
      ...updates
    });

    // Handle business rules (SMS, Inventory, etc.)
    this.handleStatusChangeEffects(updatedCall, status, updates);

    return updatedCall;
  },

  handleStatusChangeEffects(call, status, updates) {
    const customer = db.findOne('customers', c => c.customer_id === call.customer_id);
    if (!customer || !customer.phone) return;

    if (status === 'IN_ROUTE') {
      Utils.sendSMS(customer.phone, `שלום ${customer.first_name}, הטכנאי ${call.assigned_technician} בדרך אליך! נתראה בקרוב.`);
      Utils.logProtocol(`WhatsApp notification sent to office: Tech ${call.assigned_technician} is in route to ${call.call_id}`);
    } else if (status === 'ARRIVED') {
      Utils.sendSMS(customer.phone, `שלום ${customer.first_name}, הטכנאי ${call.assigned_technician} הגיע לכתובת שלך.`);
      Utils.logProtocol(`Technician arrived at ${call.address}. 15-min wait timer started.`);
    } else if (status === 'COMPLETED') {
      // Inventory Deduction
      if (updates.parts_used && Array.isArray(updates.parts_used)) {
        updates.parts_used.forEach(p => {
          const part = db.findOne('inventory', x => x.part_id === p.part_id);
          if (part) {
            db.update('inventory', x => x.part_id === p.part_id, {
              stock_level: Math.max(0, part.stock_level - p.quantity)
            });
          }
        });
      }
      Utils.sendSMS(customer.phone, `שלום ${customer.first_name}, העבודה הושלמה בהצלחה! סכום סופי: ₪${call.total_amount}. תודה שבחרת בנו.`);
      Utils.logProtocol(`Service call ${call.call_id} completed. Total: ₪${call.total_amount}. Documentation & Parts synced.`);
    }
  },

  reportNotHome(id) {
    db.update('calls', c => c.call_id === id, {
      not_home_timestamp: new Date().toISOString(),
      status: 'NOT_HOME_WAITING'
    });
    Utils.logProtocol(`NO-SHOW PROTOCOL: Tech reported customer not home for ${id}. 15-min timer started.`);
    return true;
  }
};

module.exports = CallService;

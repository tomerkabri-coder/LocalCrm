const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');
const Utils = require('./utils');
const Scheduling = require('./scheduling');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Helper to get or create customer
function getOrCreateCustomer(data) {
  let customer = db.findOne('customers', c => 
    String(c.phone) === String(data.phone) || 
    (data.email && String(c.email) === String(data.email))
  );

  if (customer) return customer.customer_id;

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
  return customerId;
}

// Unified action handler to mimic GAS doPost
app.post('/api/action', (req, res) => {
  console.log(`[${new Date().toISOString()}] POST /api/action - Content-Type: ${req.get('Content-Type')}`);
  
  const data = req.body || {};
  const action = data.action;

  if (!action) {
    console.warn("No action provided in request body. req.body:", req.body);
    return res.status(400).json({ status: "error", message: "No action provided" });
  }

  console.log(`Executing action: ${action}`);
  try {
    switch (action) {
      case "UPDATE_LOCATION":
        db.update('technicians', t => String(t.tech_id).toUpperCase() === String(data.tech_id).toUpperCase(), {
          current_lat: data.lat,
          current_lng: data.lng,
          last_location_update: new Date().toISOString()
        });
        return res.json({ status: "success" });

      case "UPDATE_TECH_STATUS":
        db.update('technicians', t => String(t.tech_id).toUpperCase() === String(data.tech_id).toUpperCase(), {
          is_active: data.is_active,
          last_update: new Date().toISOString()
        });
        return res.json({ status: "success" });

      case "START_SHIFT":
        if (!data.compliance_status) {
          return res.status(400).json({ status: "error", message: "Compliance checks must be passed" });
        }
        const shiftId = "S" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
        db.insert('shifts', {
          shift_id: shiftId,
          tech_id: data.tech_id,
          vehicle_id: data.vehicle_id || 'V1',
          start_time: new Date().toISOString(),
          end_time: "",
          type: data.type || "Morning",
          odometer_start: data.odometer_start,
          odometer_end: "",
          compliance_status: true,
          compliance_details: data.compliance_details || {}
        });
        db.update('technicians', t => String(t.tech_id).toUpperCase() === String(data.tech_id).toUpperCase(), { is_active: true });
        return res.json({ status: "success", shiftId });

      case "REPORT_NOT_HOME":
        const callNotHome = db.update('calls', c => c.call_id === data.call_id, {
          not_home_timestamp: new Date().toISOString(),
          status: 'NOT_HOME_WAITING'
        });
        Utils.logProtocol(`NO-SHOW PROTOCOL: Tech reported customer not home for ${data.call_id}. 15-min timer started.`);
        return res.json({ status: "success" });

      case "UPDATE_CALL_STATUS":
        const callToUpdate = db.findOne('calls', c => c.call_id === data.call_id);
        if (!callToUpdate) return res.status(404).json({ status: "error", message: "Call not found" });

        const updates = { ...data.updates };

        // Save base64 photos locally if present
        if (updates.before_photo && updates.before_photo.startsWith('data:image')) {
          updates.before_photo = Utils.saveFileLocally(updates.before_photo, `before_${data.call_id}.jpg`);
        }
        if (updates.measure_photo && updates.measure_photo.startsWith('data:image')) {
          updates.measure_photo = Utils.saveFileLocally(updates.measure_photo, `measure_${data.call_id}.jpg`);
        }
        if (updates.after_photo && updates.after_photo.startsWith('data:image')) {
          updates.after_photo = Utils.saveFileLocally(updates.after_photo, `after_${data.call_id}.jpg`);
        }

        // Protocol Enforcement from Ideas.md
        if (data.status === 'COMPLETED') {
          if (!updates.before_photo && !callToUpdate.before_photo) {
            return res.status(400).json({ status: "error", message: "Before photo is mandatory" });
          }
          if (!updates.after_photo) {
            return res.status(400).json({ status: "error", message: "After photo is mandatory" });
          }
        }

        // No-Show Protocol Enforcement
        if (callToUpdate.status === 'NOT_HOME_WAITING' && data.status === 'LEFT_SIGN_ON_DOOR') {
          const waitTime = (new Date() - new Date(callToUpdate.not_home_timestamp)) / 60000;
          if (waitTime < 15) {
            return res.status(400).json({ status: "error", message: `You must wait ${Math.ceil(15 - waitTime)} more minutes before leaving.` });
          }
          Utils.logProtocol(`NO-SHOW PROTOCOL COMPLETE: Tech left sign on door for ${data.call_id} after ${Math.floor(waitTime)} mins.`);
        }

        const updatedCall = db.update('calls', c => c.call_id === data.call_id, {
          status: data.status,
          ...data.updates
        });

        if (updatedCall) {
          const customer = db.findOne('customers', c => c.customer_id === updatedCall.customer_id);
          const tech = updatedCall.assigned_technician ? db.findOne('technicians', t => t.name === updatedCall.assigned_technician) : null;
          
          if (customer && customer.phone) {
            if (data.status === 'IN_ROUTE') {
              Utils.sendSMS(customer.phone, `שלום ${customer.first_name}, הטכנאי ${updatedCall.assigned_technician} בדרך אליך! נתראה בקרוב.`);
              Utils.logProtocol(`WhatsApp notification sent to office: Tech ${updatedCall.assigned_technician} is in route to ${updatedCall.call_id}`);
            } else if (data.status === 'ARRIVED') {
              Utils.sendSMS(customer.phone, `שלום ${customer.first_name}, הטכנאי ${updatedCall.assigned_technician} הגיע לכתובת שלך.`);
              Utils.logProtocol(`Technician arrived at ${updatedCall.address}. 15-min wait timer started.`);
            } else if (data.status === 'COMPLETED') {
              Utils.sendSMS(customer.phone, `שלום ${customer.first_name}, העבודה הושלמה. תודה שבחרת בנו!`);
              if (updatedCall.door_specs && JSON.parse(updatedCall.door_specs).warehouse_alert) {
                Utils.logProtocol(`WAREHOUSE ALERT: Special equipment needed for ${updatedCall.call_id}`);
              }
            }
          }
        }
        return res.json({ status: "success" });

      case "GET_TECH_CALLS":
        const calls = Scheduling.optimizeTechRoute(data.tech_id);
        return res.json({ status: "success", calls });

      case "GET_CALL_DETAILS":
        const call = db.findOne('calls', c => c.call_id === data.call_id);
        if (!call) return res.status(404).json({ status: "error", message: "Call not found" });
        
        const techData = call.assigned_technician ? db.findOne('technicians', t => t.name === call.assigned_technician) : null;
        const customer = db.findOne('customers', c => c.customer_id === call.customer_id);

        return res.json({ 
          status: "success", 
          call,
          customer: customer ? { first_name: customer.first_name, last_name: customer.last_name } : null,
          technician: techData ? {
            name: techData.name,
            lat: techData.current_lat,
            lng: techData.current_lng,
            last_update: techData.last_location_update
          } : null
        });

      case "GET_ALL_DATA":
        return res.json({ 
          status: "success", 
          calls: db.read('calls'),
          technicians: db.read('technicians'),
          notifications: db.read('notifications'),
          assignments_log: db.read('assignments_log'),
          fleet: db.read('fleet')
        });

      case "MANUAL_ASSIGN":
        db.update('calls', c => c.call_id === data.call_id, {
          status: "ASSIGNED",
          assigned_technician: data.tech_name
        });
        return res.json({ status: "success" });

      case "SET_ETA":
        db.update('calls', c => c.call_id === data.call_id, { eta: data.eta });
        return res.json({ status: "success" });

      case "GET_AVAILABLE_SLOTS":
        const slots = Scheduling.getAvailableSlots(data.lat, data.lng);
        return res.json({ status: "success", slots });

      case "GET_SMART_RECOMMENDATIONS":
        const recommendations = Scheduling.calculateTechnicianCosts(data.call_id);
        return res.json({ status: "success", recommendations });

      case "SAVE_TECHNICIAN":
        const tech = data.technician;
        if (!tech.tech_id) {
          tech.tech_id = "T" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
          db.insert('technicians', tech);
        } else {
          db.update('technicians', t => t.tech_id === tech.tech_id, tech);
        }
        return res.json({ status: "success" });

      case "DELETE_TECHNICIAN":
        db.remove('technicians', t => t.tech_id === data.tech_id);
        return res.json({ status: "success" });

      case "SAVE_CALL":
        const updatedCall = data.call;
        db.update('calls', c => c.call_id === updatedCall.call_id, updatedCall);
        return res.json({ status: "success" });

      case "SAVE_CUSTOMER":
        const customer = data.customer;
        if (!customer.customer_id) {
          customer.customer_id = "CU" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
          db.insert('customers', customer);
        } else {
          db.update('customers', c => c.customer_id === customer.customer_id, customer);
        }
        return res.json({ status: "success" });

      case "DELETE_CUSTOMER":
        db.remove('customers', c => c.customer_id === data.customer_id);
        return res.json({ status: "success" });

      default:
        // Handle call creation (default behavior)
        const callId = "C" + Utils.formatDate(new Date(), "yyyyMMdd-HHmmss");
        const priority = data.priority || 4;
        const surcharge = Utils.calculateSurcharge(priority);
        const customerId = getOrCreateCustomer(data);

        let photoUrls = [];
        if (data.photos && Array.isArray(data.photos)) {
          data.photos.forEach((photo, index) => {
            const fileName = `before_${callId}_${index}.jpg`;
            const url = Utils.saveFileLocally(photo.data, fileName);
            if (url) photoUrls.push(url);
          });
        }

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
          before_photo: photoUrls.join(","),
          after_photo: "",
          sticker_placed: false,
          notes: data.notes || "",
          door_specs: data.door_specs || {}
        };

        db.insert('calls', newCall);
        Scheduling.assignTechnician(callId);

        return res.json({
          status: "success",
          callId: callId,
          message: "Call received and being processed."
        });
    }
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ status: "error", message: error.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`Garage CRM Server running on http://localhost:${PORT}`);
});

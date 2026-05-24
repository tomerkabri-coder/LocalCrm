const CallService = require('../services/CallService');
const TechnicianService = require('../services/TechnicianService');
const CustomerService = require('../services/CustomerService');
const InventoryService = require('../services/InventoryService');
const FleetService = require('../services/FleetService');
const ShiftService = require('../services/ShiftService');
const SettingsService = require('../services/SettingsService');
const AuditService = require('../services/AuditService');
const NotificationService = require('../services/NotificationService');
const Scheduling = require('../scheduling');

const ApiController = {
  async handleAction(req, res) {
    const data = req.body || {};
    const action = data.action;

    if (!action) {
      return res.status(400).json({ status: "error", message: "No action provided" });
    }

    try {
      switch (action) {
        case "GET_ALL_DATA":
          return res.json({
            status: "success",
            calls: CallService.getAll(),
            technicians: TechnicianService.getAll(),
            customers: CustomerService.getAll(),
            inventory: InventoryService.getAll(),
            fleet: FleetService.getAll(),
            shifts: ShiftService.getAll(),
            settings: SettingsService.get(),
            notifications: NotificationService.getAll(),
            assignments_log: AuditService.getAll()
          });

        case "CREATE_CALL":
          const customer = CustomerService.getOrCreate(data);
          const newCall = CallService.create({ ...data, customer_id: customer.customer_id });
          return res.json({ status: "success", callId: newCall.call_id, message: "Call received" });

        case "UPDATE_CALL_STATUS":
          const updatedCall = CallService.updateStatus(data.call_id, data.status, data.updates);
          return res.json({ status: "success", call: updatedCall });

        case "SAVE_CALL":
          CallService.update(data.call.call_id, data.call);
          return res.json({ status: "success" });

        case "GET_TECH_CALLS":
          return res.json({ status: "success", calls: Scheduling.optimizeTechRoute(data.tech_id) });

        case "GET_TECH_HISTORY":
          const techObj = TechnicianService.getById(data.tech_id);
          if (!techObj) return res.json({ status: "success", calls: [] });
          const history = CallService.getAll().filter(c => c.assigned_technician === techObj.name && (c.status === 'COMPLETED' || c.status === 'LEFT_SIGN_ON_DOOR'));
          return res.json({ status: "success", calls: history });

        case "UPDATE_LOCATION":
          TechnicianService.updateLocation(data.tech_id, data.lat, data.lng);
          return res.json({ status: "success" });

        case "UPDATE_TECH_STATUS":
          TechnicianService.updateStatus(data.tech_id, data.is_active);
          return res.json({ status: "success" });

        case "START_SHIFT":
          const shiftId = ShiftService.save({ ...data, start_time: new Date().toISOString() });
          TechnicianService.updateStatus(data.tech_id, true);
          return res.json({ status: "success", shiftId });

        case "SAVE_TECHNICIAN":
          TechnicianService.save(data.technician);
          return res.json({ status: "success" });

        case "DELETE_TECHNICIAN":
          TechnicianService.delete(data.tech_id);
          return res.json({ status: "success" });

        case "SAVE_CUSTOMER":
          CustomerService.save(data.customer);
          return res.json({ status: "success" });

        case "DELETE_CUSTOMER":
          CustomerService.delete(data.customer_id);
          return res.json({ status: "success" });

        case "SAVE_FLEET":
          FleetService.save(data.vehicle);
          return res.json({ status: "success" });

        case "DELETE_FLEET":
          FleetService.delete(data.vehicle_id);
          return res.json({ status: "success" });

        case "SAVE_PART":
          InventoryService.save(data.part);
          return res.json({ status: "success" });

        case "DELETE_PART":
          InventoryService.delete(data.part_id);
          return res.json({ status: "success" });

        case "SAVE_SHIFT":
          ShiftService.save(data.shift);
          return res.json({ status: "success" });

        case "DELETE_SHIFT":
          ShiftService.delete(data.shift_id);
          return res.json({ status: "success" });

        case "SAVE_SETTINGS":
          SettingsService.save(data.settings);
          return res.json({ status: "success" });

        case "MANUAL_ASSIGN":
          CallService.update(data.call_id, { status: "ASSIGNED", assigned_technician: data.tech_name });
          return res.json({ status: "success" });

        case "SET_ETA":
          CallService.update(data.call_id, { eta: data.eta });
          return res.json({ status: "success" });

        case "GET_AVAILABLE_SLOTS":
          const slots = Scheduling.getAvailableSlots(data.lat, data.lng);
          return res.json({ status: "success", slots });

        case "GET_SMART_RECOMMENDATIONS":
          return res.json({ status: "success", recommendations: Scheduling.calculateTechnicianCosts(data.call_id) });

        default:
          return res.status(400).json({ status: "error", message: `Unknown action: ${action}` });
      }
    } catch (error) {
      console.error(`API Error (${action}):`, error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
};

module.exports = ApiController;

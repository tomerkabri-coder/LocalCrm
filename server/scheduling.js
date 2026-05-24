const db = require('./db');
const Utils = require('./utils');

const Scheduling = {
  assignTechnician(callId) {
    const call = db.findOne('calls', c => c.call_id === callId);
    if (!call || !call.lat || !call.lng) {
      console.log("Call missing location data: " + callId);
      return;
    }
    
    const technicians = db.findAll('technicians', t => t.is_active === true);
    
    if (technicians.length === 0) {
      console.log("No active technicians available for call: " + callId);
      db.update('calls', c => c.call_id === callId, {
        status: "PENDING_ASSIGNMENT",
        notes: (call.notes || "") + "\n[System: No active technicians available at time of request]"
      });
      return;
    }

    // Calculate score for each technician
    const scoredTechs = technicians.map(tech => {
      let score = 0;
      
      const dist = Utils.haversineDistance(call.lat, call.lng, tech.current_lat, tech.current_lng);
      tech.distance = dist;
      score += (100 - (dist * 5));
      
      const homeDist = Utils.haversineDistance(call.lat, call.lng, tech.home_lat, tech.home_lng);
      if (homeDist < 30) {
        score += 50;
      }

      if (tech.specialties && tech.specialties.includes(call.door_type)) {
        score += 30;
      }

      // Tier 3: Urgency / Priority (Higher priority calls weight more towards proximity)
      // For P1 (Emergency), we want the closest tech even if they are slightly further from home.
      const priority = parseInt(call.priority) || 4;
      if (priority === 1) score += 40;
      else if (priority === 2) score += 20;

      // Local availability check: check if tech has an ongoing call
      const ongoingCall = db.findOne('calls', c => c.assigned_technician === tech.name && ['ASSIGNED', 'IN_ROUTE', 'ARRIVED'].includes(c.status));
      if (ongoingCall) {
        score -= 200;
        tech.is_busy = true;
      } else {
        tech.is_busy = false;
      }
      
      tech.assignmentScore = score;
      return tech;
    });

    scoredTechs.sort((a, b) => b.assignmentScore - a.assignmentScore);
    const selectedTech = scoredTechs[0];
    
    console.log(`Assigned Tech: ${selectedTech.name} (Dist: ${selectedTech.distance.toFixed(1)}km, Score: ${selectedTech.assignmentScore})`);

    db.update('calls', c => c.call_id === callId, {
      status: "ASSIGNED",
      assigned_technician: selectedTech.name
    });
  },

  /**
   * Calculates the incremental cost for each technician to take a new call.
   * This is a Dijkstra-inspired approach where we find the "shortest path" 
   * to integrate the new call into the existing schedule.
   */
  calculateTechnicianCosts(callId) {
    const call = db.findOne('calls', c => c.call_id === callId);
    if (!call) return [];

    const activeTechs = db.findAll('technicians', t => t.is_active === true);
    
    return activeTechs.map(tech => {
      const currentRoute = this.optimizeTechRoute(tech.tech_id);
      
      // Calculate original route cost
      let originalCost = 0;
      let curLat = tech.current_lat;
      let curLng = tech.current_lng;
      
      currentRoute.forEach(c => {
        originalCost += Utils.haversineDistance(curLat, curLng, c.lat, c.lng);
        curLat = c.lat;
        curLng = c.lng;
      });

      // Find the best insertion point (Cheapest Insertion - similar to Dijkstra's greedy selection)
      let minIncrementalCost = Infinity;
      let bestPos = 0;

      for (let i = 0; i <= currentRoute.length; i++) {
        const testRoute = [...currentRoute];
        testRoute.splice(i, 0, call);
        
        let testCost = 0;
        let tLat = tech.current_lat;
        let tLng = tech.current_lng;
        
        testRoute.forEach(c => {
          testCost += Utils.haversineDistance(tLat, tLng, c.lat, c.lng);
          tLat = c.lat;
          tLng = c.lng;
        });

        const incremental = testCost - originalCost;
        if (incremental < minIncrementalCost) {
          minIncrementalCost = incremental;
          bestPos = i;
        }
      }

      // Add "Time Weights" (Schedule cost)
      // Each existing call adds ~60 mins of service time cost
      const scheduleTimeCost = currentRoute.length * 20; // 20km equivalent weight per call
      const totalCost = minIncrementalCost + scheduleTimeCost;

      // Specialty Match Bonus
      const specialtyBonus = (tech.specialties && tech.specialties.includes(call.door_type)) ? -15 : 0;

      return {
        tech_id: tech.tech_id,
        name: tech.name,
        incremental_dist: minIncrementalCost,
        schedule_weight: scheduleTimeCost,
        total_path_cost: totalCost + specialtyBonus,
        is_busy: currentRoute.length > 0,
        queue_length: currentRoute.length,
        best_insertion_pos: bestPos
      };
    }).sort((a, b) => a.total_path_cost - b.total_path_cost);
  },

  optimizeTechRoute(techId) {
    const tech = db.findOne('technicians', t => String(t.tech_id).toUpperCase() === String(techId).toUpperCase());
    if (!tech) return [];

    const techName = tech.name;
    const allCalls = db.findAll('calls', c => c.assigned_technician === techName && c.status !== 'COMPLETED' && c.status !== '');
    
    if (allCalls.length <= 1) return allCalls;

    const activeCalls = allCalls.filter(c => c.status === 'IN_ROUTE' || c.status === 'ARRIVED');
    let remainingCalls = allCalls.filter(c => c.status === 'ASSIGNED');

    const optimizedRoute = [...activeCalls];
    
    let currentLat, currentLng;
    if (activeCalls.length > 0) {
      const lastActive = activeCalls[activeCalls.length - 1];
      currentLat = Number(lastActive.lat);
      currentLng = Number(lastActive.lng);
    } else {
      currentLat = Number(tech.current_lat) || 32.0853;
      currentLng = Number(tech.current_lng) || 34.7818;
    }

    while (remainingCalls.length > 0) {
      let bestNextIdx = -1;
      let minCost = Infinity;

      for (let i = 0; i < remainingCalls.length; i++) {
        const callLat = Number(remainingCalls[i].lat);
        const callLng = Number(remainingCalls[i].lng);
        if (isNaN(callLat) || isNaN(callLng)) continue;

        const dist = Utils.haversineDistance(currentLat, currentLng, callLat, callLng);
        const priorityWeight = (remainingCalls[i].priority || 4) * 0.25; 
        const cost = dist * priorityWeight;

        if (cost < minCost) {
          minCost = cost;
          bestNextIdx = i;
        }
      }

      if (bestNextIdx === -1) break;

      const nextCall = remainingCalls.splice(bestNextIdx, 1)[0];
      optimizedRoute.push(nextCall);

      currentLat = Number(nextCall.lat);
      currentLng = Number(nextCall.lng);
    }

    if (remainingCalls.length > 0) {
      optimizedRoute.push(...remainingCalls);
    }

    return optimizedRoute;
  },

  getAvailableSlots(customerLat, customerLng) {
    const slots = [];
    const workingHours = { start: 8, end: 18 };
    const slotDurationMs = 2 * 60 * 60 * 1000;
    const activeTechs = db.findAll('technicians', t => t.is_active === true);

    if (activeTechs.length === 0) return [];

    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      date.setMinutes(0, 0, 0);
      
      for (let hour = workingHours.start; hour < workingHours.end; hour += 2) {
        const slotStart = new Date(date);
        slotStart.setHours(hour);
        const slotEnd = new Date(slotStart.getTime() + slotDurationMs);

        if (slotStart < new Date()) continue;

        // Check if any tech can handle this slot
        const availableTechsForSlot = activeTechs.filter(tech => {
          // 1. Basic distance check (Is this customer in the tech's general area?)
          const dist = (customerLat && customerLng) 
            ? Utils.haversineDistance(customerLat, customerLng, tech.current_lat, tech.current_lng)
            : 0;
          
          if (dist > 100) return false; // Too far for a standard call

          // 2. Schedule overlap check (Does tech have a call near this time?)
          const existingCalls = db.findAll('calls', c => 
            c.assigned_technician === tech.name && 
            c.scheduled_time && 
            Math.abs(new Date(c.scheduled_time) - slotStart) < slotDurationMs
          );

          return existingCalls.length === 0;
        });

        if (availableTechsForSlot.length > 0) {
          // Heuristic: If we have many techs, it's "Highly Available"
          const availabilityLevel = availableTechsForSlot.length > 1 ? "גבוהה" : "בינונית";
          
          slots.push({
            start: slotStart,
            end: slotEnd,
            id: slotStart.toISOString(),
            label: `${slotStart.toLocaleDateString('he-IL')} בשעות ${slotStart.getHours()}:00 - ${slotEnd.getHours()}:00`,
            availability: availabilityLevel
          });
        }
      }
    }
    return slots;
  }
};

module.exports = Scheduling;

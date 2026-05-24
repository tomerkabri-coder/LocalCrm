const fs = require('fs');
const path = require('path');

const Utils = {
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },
  
  toRad(deg) {
    return deg * (Math.PI / 180);
  },

  isNightTime(date = new Date()) {
    const hours = date.getHours();
    return hours >= 18 || hours < 7;
  },

  calculateSurcharge(priority, date = new Date()) {
    let surcharge = 0;
    if (this.isNightTime(date)) {
      surcharge += 150;
    }
    if (priority <= 2) {
      surcharge += 100;
    }
    return surcharge;
  },

  saveFileLocally(base64Data, fileName) {
    try {
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }

      const base64Content = base64Data.split(',')[1];
      const buffer = Buffer.from(base64Content, 'base64');
      const filePath = path.join(uploadsDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      
      // Return a local URL or path
      return `/uploads/${fileName}`;
    } catch (e) {
      console.error("Error saving file:", e);
      return null;
    }
  },

  formatDate(date, format) {
    // Basic date formatting to mimic GAS Utilities.formatDate
    const d = new Date(date);
    const pad = (n) => n.toString().padStart(2, '0');
    
    if (format === "yyyyMMdd-HHmmss") {
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    }
    return d.toISOString();
  },

  sendSMS(to, message) {
    console.log(`[SMS] To: ${to} | Message: ${message}`);
    // In a real app, this would call Twilio or another API.
    // For POC, we log it to a file.
    const db = require('./db');
    db.insert('notifications', {
      timestamp: new Date().toISOString(),
      to,
      message,
      type: 'SMS'
    });
    return true;
  },

  logProtocol(message) {
    console.log(`[PROTOCOL] ${message}`);
    const db = require('./db');
    db.insert('assignments_log', {
      timestamp: new Date().toISOString(),
      action: 'PROTOCOL_EVENT',
      details: message
    });
  }
};

module.exports = Utils;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Middleware
const Logger = require('./middleware/Logger');
const ErrorHandler = require('./middleware/ErrorHandler');

// Controllers
const ApiController = require('./controllers/ApiController');

const app = express();
const PORT = process.env.PORT || 3000;

// Standard Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(Logger);

// Static Assets
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Legacy API Bridge (Backward Compatibility)
app.post('/api/action', ApiController.handleAction);

// Health Check
app.get('/health', (req, res) => res.json({ status: 'UP', timestamp: new Date() }));

// Global Error Handler
app.use(ErrorHandler);

app.listen(PORT, () => {
  console.log(`
  🚀 Garage CRM Server Modernized
  ------------------------------
  Local:   http://localhost:${PORT}
  Health:  http://localhost:${PORT}/health
  API:     http://localhost:${PORT}/api/action
  `);
});

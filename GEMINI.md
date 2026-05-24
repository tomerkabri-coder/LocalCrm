# Project Gemini Context: Garage CRM POC (Local Edition)

This project is a standalone **Garage CRM System** designed to run entirely on a local PC. It has been rewritten from the original Google Apps Script version to a Node.js-based local-first architecture.

## Project Overview
The system manages service calls with fault details, urgency, and location. It programmatically enforces operational protocols defined in `Ideas.md`, including shift compliance and job execution documentation.

### Core Technologies
- **Database:** Local JSON files (`data/` directory) with relational modeling.
- **Backend:** Node.js Express Server (`server/` directory).
- **Business Logic:** Protocol Enforcement Engine (validated photos, compliance flags).
- **Frontend:** Static HTML/JS with Tailwind CSS (Customer, Technician, and Dispatcher apps).
- **Launcher:** Unified `start-garage.bat` for easy local startup.

## Local Architecture
- **Server:** Handles API requests, assignment algorithms (Haversine distance), and auditing.
- **Database Schema:** 
  - `calls.json`: Core service records.
  - `technicians.json`: Technician profiles and active status.
  - `customers.json`: Persistent customer database.
  - `shifts.json`: Auditable shift compliance logs.
  - `fleet.json`: Vehicle maintenance and odometer tracking.
  - `notifications.json`: Mock SMS/WhatsApp logs.
  - `assignments_log.json`: Detailed protocol event audit trail.

## Operational Protocols (Enforced)

### 1. Shift Entry Protocol
- **Validation:** Technicians must verify vehicle compliance (oil, water, lights) and visibility approval (uniform, shoes) before starting a shift.
- **Server Action:** `START_SHIFT` is blocked if compliance flags are not met.

### 2. Job Execution Protocol
- **Arrival:** Automatic logging and mock notification to customer/office.
- **No-Show Protocol:** Enforces a 15-minute wait timer if the customer is not home. The technician must wait before being allowed to leave a sign and move on.
- **Documentation:** "Before" and "After" photos are programmatically required to complete a job.
- **Financials:** Enforces deposit tracking and surcharge application (Night/Emergency).
- **Specifications:** Captures granular door attributes (Manufacturer, Trim, Struts).

## How to Run
1.  Ensure **Node.js** is installed.
2.  Run `start-garage.bat` from the project root.
3.  Access the apps via the provided URLs (Port 8081-8083).

## Key Features (Local Rewrite)
- **Smart Dispatch (Dijkstra-Inspired):** Optimization engine that calculates the incremental path cost for each technician, considering their entire schedule and current location to recommend the most efficient assignment.
- **Scoring Engine:** Automated technician assignment based on Proximity, Home Distance, and Urgency.
- **Protocol Audit:** Full audit trail of all field actions visible in the Dispatcher Dashboard.
- **Financial Analytics:** Real-time revenue tracking, deposit monitoring, and technician commission calculation.
- **Inventory & Warehouse:** Tracking of service by manufacturer and active warehouse alerts for special equipment.
- **Operational Performance:** Analytics dashboard tracking response times, sales conversion rates, and technician efficiency ratings.
- **Communication Suite:** One-click WhatsApp dispatching and mock SMS notification logging.
- **PWA Ready:** Technician app optimized for mobile with service worker support.
- **Offline Resilience:** Local JSON storage ensures the system works even without an internet connection (once assets are cached).

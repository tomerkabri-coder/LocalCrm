Technical Design Specification: Field Service Management Platform for Garage Door Operations



1\. Executive Architectural Analysis and Data Modeling



The strategic importance of translating physical operational protocols—such as vehicle maintenance, on-site technician conduct, and sales procedures—into a digital data architecture is paramount for scaling service operations. By codifying real-world workflows into a structured relational schema, the organization eliminates "tribal knowledge" dependencies and operational friction. This architecture ensures data integrity across the technician lifecycle: from the moment a technician checks their vehicle’s "Vehicle Mail" (odometer) to the archival of a signed door replacement contract. A robust digital model transforms qualitative checklists into hard validation rules, ensuring that safety protocols (like vehicle light checks) and financial controls (like 30%–50% deposits) are programmatically enforced rather than suggested.



Relational Database Schema (PostgreSQL)



The following schema translates the Hebrew operational protocols into a normalized relational model.



Table	Column	Type	Description

Technicians	id, name, email, role	UUID, String	System roles: Technician, Dispatch, Admin.

&nbsp;	standby\_rate	Decimal	Symbolic payment for on-call/night shifts.

&nbsp;	commission\_rate	Decimal	Percentage-based incentive per job.

&nbsp;	home\_address\_coords	PostGIS Point	Used for the "30-min from home" dispatch rule.

Fleet	id, license\_plate	UUID, String	Unique vehicle identifier.

&nbsp;	weekly\_odometer	Integer	"Vehicle Mail" tracking for maintenance intervals.

&nbsp;	status	Enum	Active, Maintenance Required, Out of Service.

Shifts	id, tech\_id, vehicle\_id	UUID, FKs	Maps technician to vehicle and service area.

&nbsp;	type	Enum	Morning (07:00-15:00), Evening (15:00-23:00), Night (On-call).

&nbsp;	visibility\_approved	Boolean	Verification of dress code (Steel-toed boots, logo shirt).

Jobs	id, customer\_id, tech\_id	UUID, FKs	Core service record.

&nbsp;	subcontractor\_id	UUID (Optional)	Fallback ID if no internal technician is available.

&nbsp;	priority\_level	Integer (1-4)	1: Off-track, 2: Broken Spring, 3: Emergency, 4: Motor/Est.

&nbsp;	recording\_url	String	URI for mandatory call recording (S3/Blob).

&nbsp;	sticker\_placed	Boolean	Mandatory check for "Sticker in prominent garage place."

Door\_Specs	job\_id	UUID (FK)	Links job to specific inventory requirements.

&nbsp;	manufacturer	Enum	Amarr, Clopay, Safeway, Wayne Dalton, CHI, Raynor.

&nbsp;	attributes	JSONB	{bottom\_panel: bool, trim: {exists: bool, color: string}, struts: string}

&nbsp;	mechanics	JSONB	{springs: "torsion/extension", track\_radius: "high-lift/std"}



From Raw Data to Business Intelligence



This normalized schema facilitates the transition from field data to actionable intelligence. By tracking weekly\_odometer against job density, the system predicts maintenance windows. Simultaneously, linking priority\_level and timestamp allows the business to audit the "Emergency Fee" and "Night Fee" (after 18:00) application accuracy.





--------------------------------------------------------------------------------





2\. Backend Infrastructure and Business Logic Implementation



A centralized API acts as the orchestration layer for the complex state of field operations. It manages the transition from a lead's "Source" call to a dispatched unit, ensuring that no state change occurs without satisfying the underlying business protocols (e.g., photo verification or customer signature).



RESTful API Specification



\* GET /dispatch/suggest-tech: The Scheduling Engine.

&nbsp; \* Logic: Calculates tech assignment based on three tiers: 1. Proximity (within 1-hour travel radius), 2. Home Distance (under 30-min drive from tech's residence), and 3. Urgency.

&nbsp; \* Fallback: If no technician meets availability/distance criteria, the logic triggers a dispatch\_to\_subcontractor event.

\* POST /jobs/{id}/estimate: The Protocol Service.

&nbsp; \* Logic: Validates that a 30%–50% deposit is captured for new door sales. Enforces a digital signature requirement before the status can move to "Work in Progress."

\* PATCH /jobs/{id}/status:

&nbsp; \* Logic: State transitions (e.g., Arrived to Complete) are blocked unless the request contains before\_photo\_url, after\_photo\_url, and measurement\_photo\_url (showing tape measure on door profile).

\* GET /comms/recordings/{job\_id}:

&nbsp; \* Logic: Interfaces with the telephony provider to ensure every customer interaction is recorded and indexed against the job ID for quality assurance.



Business Rules Engine



Operational Rule	Condition Trigger	Backend Validation Logic

No-Show Protocol	Customer "Not Home"	Enforce 15-min wait timer via timestamp comparison before allowing "Leave sign on door" status.

Emergency/Night Fees	Priority 1-3 OR Time > 18:00	Inject SURCHARGE\_EMERGENCY or SURCHARGE\_NIGHT line items into the Estimate object.

Vehicle Compliance	Shift Initialization	Block ShiftStart if oil\_check, water\_check, and light\_check are not boolean true.

Visibility Approval	Shift Initialization	Require photo upload and boolean check for: Closed shoes, long pants, logo shirt, and (winter) hat.

Sales Validation	Door Replacement	Mandatory JSON fields: bottom\_panel, trim\_color, and strut\_count.



This backend architecture ensures that UI-level actions are strictly governed by the "נוהל עלייה למשמרת" (Shift Entry Protocol), reducing human error in the field.





--------------------------------------------------------------------------------





3\. Frontend Architecture and UX Strategy



The frontend employs a "Mobile-First" approach, acknowledging the tactile and high-pressure nature of garage door repair. The UI acts as a digital supervisor, forcing technicians through a "Protocol Checklist" that ensures administrative compliance (photos, signatures, stickers) matches the mechanical quality of the repair.



Modular Component Hierarchy



1\. Technician Field App (/mobile)

&nbsp; \* ShiftEntryWizard: A gated entry point requiring vehicle inspection (Oil, Water, Air Pressure, Lights) and "Visibility Approval" (Dress code check).

&nbsp; \* JobExecutionStepper:

&nbsp;   \* Arrival: WhatsApp dispatch notification to "Office" group and 30-min customer call trigger.

&nbsp;   \* Inspection: Mandatory "Before" photo and history review of "Returning Customer" notes/previous pricing.

&nbsp;   \* Closing: "After" photo upload, "Sticker Placed" confirmation, and "Warehouse Alert" for special equipment needed for the next day.

2\. Dispatch Dashboard (/admin)

&nbsp; \* LeadMapComponent: Real-time GIS view showing technicians relative to "1-hour service circles."

&nbsp; \* UrgencyFeed: High-priority queue for Level 1 (Off-track) and Level 2 (Broken Spring) emergencies.



Data Visualization Strategy (Mockup)



To drive sales performance based on the "פרוטוקול מכירה" (Sales Protocol), the admin dashboard includes a Sales Conversion \& Inventory Leaderboard:



Technician	Leads	Sold Doors	Conversion Rate	Top Manufacturer

Levi, A.	45	18	40%	Amarr

Cohen, D.	38	12	31%	Clopay

Subcontractor-01	22	4	18%	Safeway



Visualization Logic: Tracks "Estimate Only" vs. "Collected Deposit (30-50%)" to calculate true ROI.





--------------------------------------------------------------------------------





4\. System Security and Deployment Framework



Handling customer addresses, financial deposits, and call recordings necessitates a hardened security posture and a reproducible deployment environment.



Security Layer



\* CORS \& Rate Limiting: API access restricted to authorized mobile bundles. Rate limiting prevents brute-force scraping of customer lead data.

\* Input Validation: Strict schema validation for "Door Measurement" forms using Zod/Joi to prevent corrupted specs from reaching the procurement department.

\* Recording Privacy: Signed URLs for S3 buckets containing call recordings, ensuring only "Office" roles can access audio logs.



Deployment Configuration



docker-compose.yml



version: '3.8'

services:

&nbsp; db:

&nbsp;   image: postgres:15-alpine

&nbsp;   environment:

&nbsp;     POSTGRES\_DB: garage\_ops\_db

&nbsp;     POSTGRES\_PASSWORD: ${DB\_PASSWORD}

&nbsp;   volumes:

&nbsp;     - pgdata:/var/lib/postgresql/data # Ensure data persistence for odometer/maintenance logs

&nbsp; backend:

&nbsp;   build: ./backend

&nbsp;   environment:

&nbsp;     - WHATSAPP\_API\_KEY=${WA\_KEY}

&nbsp;     - RECORDING\_SERVICE\_URL=${REC\_URL}

&nbsp;   depends\_on:

&nbsp;     - db

&nbsp; frontend:

&nbsp;   build: ./frontend

&nbsp;   ports:

&nbsp;     - "80:80"



volumes:

&nbsp; pgdata:







Conclusion



This architecture transforms the "נוהל עלייה למשמרת" (Shift Entry Protocol) and "פרוטוקול מכירה" (Sales Protocol) from static documents into a high-integrity, scalable engine. By automating urgency-based dispatching, enforcing photo-documented compliance, and codifying complex sales attributes (Trim, Bottom Panels, Struts), the platform ensures a consistent, professional, and data-driven service enterprise.




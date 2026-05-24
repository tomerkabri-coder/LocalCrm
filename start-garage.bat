@echo off
echo Starting Garage CRM POC...
echo.

:: Start the Backend Server
start "CRM-Server" node server/index.js

:: Start the Customer App
start "Customer-App" .\node_modules\.bin\live-server.cmd customer-app --port=8081 --no-browser

:: Start the Technician App
start "Technician-App" .\node_modules\.bin\live-server.cmd technician-app --port=8083 --no-browser

:: Start the Dispatcher Dashboard
start "Dispatcher-App" .\node_modules\.bin\live-server.cmd dispatcher-app --port=8082 --no-browser

echo All components started!
echo Backend: http://localhost:3000
echo Customer App: http://localhost:8081
echo Technician App: http://localhost:8083
echo Dispatcher App: http://localhost:8082
echo.
pause

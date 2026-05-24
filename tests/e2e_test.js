const API_URL = "http://localhost:3000/api/action";

async function test() {
  console.log("🚀 Starting E2E Test...");

  try {
    // 1. Create a service call (Customer App)
    console.log("\n1️⃣ Creating a service call...");
    const callData = {
      action: "CREATE_CALL", // The server default case handles this
      first_name: "Test",
      last_name: "User",
      phone: "054-0000000",
      email: "test@example.com",
      address: "Tel Aviv, Israel",
      lat: 32.0853,
      lng: 34.7818,
      priority: 3,
      issue_type: "Broken Spring", // Added for clarity
      notes: "Door won't open"
    };

    const createRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callData)
    });
    const createResult = await createRes.json();
    console.log("Create Call Result:", createResult);

    if (createResult.status !== "success") throw new Error("Failed to create call");
    const callId = createResult.callId;

    // 2. Start Technician Shift (T1)
    console.log("\n2️⃣ Starting technician shift (T1)...");
    const shiftData = {
      action: "START_SHIFT",
      tech_id: "T1",
      vehicle_id: "V1",
      odometer_start: 10000,
      type: "Morning",
      compliance_status: true
    };
    const shiftRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shiftData)
    });
    const shiftResult = await shiftRes.json();
    console.log("Start Shift Result:", shiftResult);

    // 3. Get Technician Calls
    console.log("\n3️⃣ Fetching calls for T1...");
    const getCallsRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "GET_TECH_CALLS", tech_id: "T1" })
    });
    const getCallsResult = await getCallsRes.json();
    console.log("T1 Calls:", getCallsResult.calls.map(c => c.call_id));
    
    const hasCall = getCallsResult.calls.some(c => c.call_id === callId);
    console.log(`Call ${callId} assigned to T1?`, hasCall);

    // 4. Update Status to IN_ROUTE
    console.log("\n4️⃣ Updating call status to IN_ROUTE...");
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "UPDATE_CALL_STATUS", call_id: callId, status: "IN_ROUTE" })
    });

    // 5. Update Status to ARRIVED
    console.log("\n5️⃣ Updating call status to ARRIVED...");
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "UPDATE_CALL_STATUS", call_id: callId, status: "ARRIVED" })
    });

    // 6. Complete Job
    console.log("\n6️⃣ Completing the job...");
    const completionData = {
      action: "UPDATE_CALL_STATUS",
      call_id: callId,
      status: "COMPLETED",
      updates: {
        total_amount: 500,
        deposit_paid: 100,
        notes: "Fixed the spring",
        after_photo: "http://example.com/after.jpg"
      }
    };
    const completeRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completionData)
    });
    const completeResult = await completeRes.json();
    console.log("Completion Result:", completeResult);

    // 7. Verify final state
    console.log("\n7️⃣ Verifying final state and notifications...");
    const verifyRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "GET_ALL_DATA" })
    });
    const verifyResult = await verifyRes.json();
    const finalCall = verifyResult.calls.find(c => c.call_id === callId);
    console.log("Final Call Status:", finalCall.status);
    console.log("Final Call Amount:", finalCall.total_amount);

    const callNotifications = verifyResult.notifications.filter(n => n.message.includes(callId) || n.message.includes("Test"));
    console.log("Notifications Sent:", callNotifications.length);
    callNotifications.forEach(n => console.log(`- [${n.type}] To: ${n.to} | ${n.message}`));

    if (finalCall.status === "COMPLETED" && callNotifications.length >= 2) {
      console.log("\n✅ E2E Test Passed with Notifications!");
    } else {
      console.log("\n❌ E2E Test Failed!");
      process.exit(1);
    }

  } catch (error) {
    console.error("\n❌ Test Error:", error);
    process.exit(1);
  }
}

test();

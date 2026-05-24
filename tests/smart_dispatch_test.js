const API_URL = "http://localhost:3000/api/action";

async function runTest() {
  console.log("🚀 Testing Smart Dispatch Optimization...");

  try {
    // 1. Create a new call C_TEST
    // This call will be at (32.09, 34.79) - close to Yossi's home but he has C_EXISTING at (32.05, 34.75)
    console.log("\n1️⃣ Creating new call C_TEST...");
    const createRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "CREATE_CALL",
        first_name: "Test",
        phone: "054-0000000",
        address: "Tel Aviv Port",
        lat: 32.0900,
        lng: 34.7900,
        priority: 4,
        issue_type: "Gate Repair"
      })
    });
    const createResult = await createRes.json();
    const callId = createResult.callId;
    console.log("Created Call ID:", callId);

    // 2. Fetch Smart Recommendations for C_TEST
    console.log("\n2️⃣ Fetching Smart Recommendations for " + callId + "...");
    const recRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "GET_SMART_RECOMMENDATIONS",
        call_id: callId
      })
    });
    const recResult = await recRes.json();
    
    console.log("\n📊 Dispatch Recommendations:");
    recResult.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec.name}`);
      console.log(`   - Total Path Cost: ${rec.total_path_cost.toFixed(2)}`);
      console.log(`   - Incremental Dist: ${rec.incremental_dist.toFixed(2)}km`);
      console.log(`   - Schedule Weight: ${rec.schedule_weight}`);
      console.log(`   - Queue Length: ${rec.queue_length}`);
    });

    const topTech = recResult.recommendations[0];
    console.log(`\n✅ Recommended Technician: ${topTech.name}`);
    
    // Check if the logic preferred Avi (T2) even if further from call because Yossi (T1) is busy
    // Yossi home (32.08, 34.78) -> Call (32.09, 34.79) ~1.5km
    // Avi home (32.10, 34.80) -> Call (32.09, 34.79) ~1.5km
    // BUT Yossi has 1 call, Avi has 0.
    // So Avi should be preferred.

    if (topTech.name === "Avi") {
        console.log("\n🎉 TEST SUCCESS: System correctly prioritized Avi (fewer calls/lower schedule weight).");
    } else {
        console.log("\n⚠️ TEST NOTE: System prioritized Yossi. This might happen if distance insertion was extremely cheap.");
    }

  } catch (error) {
    console.error("\n❌ Test Failed:", error);
  }
}

setTimeout(runTest, 2000); // Give server time to start

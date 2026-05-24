const API_URL = "http://localhost:3000/api/action";

async function testScheduling() {
    console.log("🚀 Testing Location-Aware Scheduling...");

    try {
        // 1. Setup Environment: Make sure T1 and T2 are active and in specific locations
        // T1 is in Center (32.08, 34.78), T2 is in North (32.79, 34.98)
        console.log("\n1️⃣ Verifying technician locations...");
        const allDataRes = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "GET_ALL_DATA" })
        });
        const allData = await allDataRes.json();
        const activeTechs = allData.technicians.filter(t => t.is_active);
        console.log(`Active Techs: ${activeTechs.length}`);
        activeTechs.forEach(t => console.log(` - ${t.name} at (${t.current_lat}, ${t.current_lng})`));

        // 2. Request slots for a location in the CENTER (Tel Aviv)
        console.log("\n2️⃣ Requesting slots for Tel Aviv (32.08, 34.78)...");
        const centerRes = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: "GET_AVAILABLE_SLOTS", 
                lat: 32.0853, 
                lng: 34.7818 
            })
        });
        const centerSlots = await centerRes.json();
        console.log(`Slots found: ${centerSlots.slots.length}`);
        if (centerSlots.slots.length > 0) {
            console.log(`Sample Slot: ${centerSlots.slots[0].label} | Avail: ${centerSlots.slots[0].availability}`);
        }

        // 3. Request slots for a location in the SOUTH (Eilat - 29.55, 34.95) 
        // This is > 100km from our techs, should return 0 slots or error
        console.log("\n3️⃣ Requesting slots for Eilat (29.55, 34.95) - SHOULD BE TOO FAR...");
        const southRes = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: "GET_AVAILABLE_SLOTS", 
                lat: 29.5581, 
                lng: 34.9482 
            })
        });
        const southSlots = await southRes.json();
        console.log(`Slots found for Eilat: ${southSlots.slots.length}`);

        // 4. Verification
        if (centerSlots.slots.length > 0 && southSlots.slots.length === 0) {
            console.log("\n✅ TEST PASSED: Slots are correctly filtered by proximity!");
        } else {
            console.log("\n❌ TEST FAILED: Distance filtering logic not behaving as expected.");
            console.log(`Center Count: ${centerSlots.slots.length}, South Count: ${southSlots.slots.length}`);
        }

    } catch (error) {
        console.error("\n❌ Test Error:", error);
    }
}

testScheduling();

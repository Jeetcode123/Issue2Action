async function runDemo() {
    console.log("==================================================");
    console.log("🚀 STARTING ISSUE2ACTION AUTO-SIMULATION DEMO");
    console.log("==================================================\n");

    try {
        console.log("1. Simulating User Submission...");
        const payload = {
            description: "There is an extreme garbage overflow right in the middle of Sector 5 street. It's causing a terrible stench and blocking the road, creating a health hazard.",
            location_text: "Sector 5 Main Road",
            latitude: 22.5804,
            longitude: 88.4326,
            ward: "Sector 5",
            user_id: "00000000-0000-0000-0000-000000000000" // Dummy ID
        };

        console.log(`   [POST] /api/issues/create`);
        console.log(`   Payload: ${JSON.stringify(payload)}\n`);

        const startTime = Date.now();
        const response = await fetch(process.env.NEXT_PUBLIC_API_BASE_URL+'/api/issues/create', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        const duration = Date.now() - startTime;
        
        if (!response.ok) {
           console.error("HTTP ERROR:", data);
           return;
        }

        console.log("2. AI Processing Results:");
        console.log(`   ✅ Target Authority Department: ${data.data.department}`);
        console.log(`   ✅ Issue Classification: ${data.data.type}`);
        console.log(`   ✅ Priority Level: ${data.data.priority}`);
        console.log(`   ✅ Estimated Fix Time: ${data.data.eta}`);
        console.log(`   ✅ Ticket ID generated: ${data.data.ticket_id}`);
        console.log(`   ⏱ Time taken: ${duration}ms\n`);

        console.log("3. Email Dispatch Initialized (check server background logs for specific Message-ID/URL).");
        console.log("   Test Passed Successfully! ✔️");

    } catch (e) {
        console.error("❌ DEMO FAILED");
        console.error(e.message);
    }
}

runDemo();

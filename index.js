import express from "express";
import { LightstreamerClient, Subscription } from "lightstreamer-client-node";

const app = express();
const PORT = 3000;

// This will store the latest urine tank value
let urineTank = null;

// Connect to NASA ISS Live Lightstreamer server
const client = new LightstreamerClient(
  "https://push.lightstreamer.com",
  "ISSLIVE"
);

// Subscribe to telemetry item "NODE3000005" (Urine Tank %)
const subscription = new Subscription(
  "MERGE",
  ["NODE3000005"],      // item name
  ["Value"]             // field we need
);

// When Lightstreamer pushes updates
subscription.addListener({
  onItemUpdate: (update) => {
    const value = update.getValue("Value");
    urineTank = parseFloat(value);

    console.log("Updated Urine Tank Level:", urineTank, "%");
  }
});

// Connect and subscribe
client.connect();
client.subscribe(subscription);

// REST API Endpoint
app.get("/urine", (req, res) => {
  if (urineTank === null) {
    return res.status(503).json({
      status: "loading",
      message: "Telemetry not received yet. Try again in a few seconds."
    });
  }

  res.json({
    urineTankPercentage: urineTank
  });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/urine`);
});
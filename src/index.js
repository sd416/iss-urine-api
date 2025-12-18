import { LightstreamerClient, Subscription } from "lightstreamer-client-node";

// Durable Object to maintain persistent Lightstreamer connection
export class UrineTracker {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.urineTank = null;
    this.client = null;
    this.subscription = null;
  }

  async fetch(request) {
    // Initialize Lightstreamer connection if not already connected
    if (!this.client) {
      await this.initializeLightstreamer();
    }

    const url = new URL(request.url);
    
    if (url.pathname === "/urine") {
      if (this.urineTank === null) {
        return new Response(
          JSON.stringify({
            status: "loading",
            message: "Telemetry not received yet. Try again in a few seconds."
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({
          urineTankPercentage: this.urineTank
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  }

  async initializeLightstreamer() {
    // Connect to NASA ISS Live Lightstreamer server
    this.client = new LightstreamerClient(
      "https://push.lightstreamer.com",
      "ISSLIVE"
    );

    // Subscribe to telemetry item "NODE3000005" (Urine Tank %)
    this.subscription = new Subscription(
      "MERGE",
      ["NODE3000005"],      // item name
      ["Value"]             // field we need
    );

    // When Lightstreamer pushes updates
    this.subscription.addListener({
      onItemUpdate: (update) => {
        const value = update.getValue("Value");
        this.urineTank = parseFloat(value);
        console.log("Updated Urine Tank Level:", this.urineTank, "%");
      }
    });

    // Connect and subscribe
    this.client.connect();
    this.client.subscribe(this.subscription);
  }
}

// Main Worker handler
export default {
  async fetch(request, env, ctx) {
    // Get the Durable Object stub
    const id = env.URINE_TRACKER.idFromName("urine-tracker-singleton");
    const stub = env.URINE_TRACKER.get(id);
    
    // Forward the request to the Durable Object
    return stub.fetch(request);
  }
};

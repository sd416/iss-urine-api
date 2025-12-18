// Configuration constants
const LIGHTSTREAMER_URL = "wss://push.lightstreamer.com/lightstreamer";
const LIGHTSTREAMER_ADAPTER = "ISSLIVE";
const LIGHTSTREAMER_CLIENT_ID = "mgQkwtwdysogQz2BJ4Ji%20kOj2Bg";
const TELEMETRY_ITEM = "NODE3000005"; // Urine Tank %
const TELEMETRY_FIELD = "Value";
const SUBSCRIPTION_ID = "1";
const REQUEST_ID = "1";
const KEEPALIVE_INTERVAL_MS = 30000; // 30 seconds

// Durable Object to maintain persistent WebSocket connection to Lightstreamer
export class UrineTracker {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.urineTank = null;
    this.ws = null;
    this.sessionId = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    // Initialize WebSocket connection if not already connected
    if (!this.ws) {
      await this.initializeWebSocket();
    }

    if (url.pathname === "/urine") {
      if (this.urineTank === null) {
        return new Response(
          JSON.stringify({
            status: "loading",
            message: "Telemetry not received yet. Try again in a few seconds."
          }),
          {
            status: 503,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }

      return new Response(
        JSON.stringify({
          urineTankPercentage: this.urineTank
        }),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  }

  async initializeWebSocket() {
    try {
      // Create WebSocket connection
      this.ws = new WebSocket(LIGHTSTREAMER_URL);
      
      this.ws.addEventListener("open", () => {
        console.log("WebSocket connected to Lightstreamer");
        
        // Send create_session request
        const createSession = `create_session\r\nLS_adapter_set=${LIGHTSTREAMER_ADAPTER}&LS_cid=${LIGHTSTREAMER_CLIENT_ID}&LS_send_sync=false&LS_cause=api\r\n`;
        this.ws.send(createSession);
      });

      this.ws.addEventListener("message", (event) => {
        const data = event.data;
        console.log("WebSocket message:", data);
        
        // Parse Lightstreamer protocol messages
        if (data.includes("CONOK")) {
          // Session created successfully
          const match = data.match(/CONOK,(\S+),/);
          if (match) {
            this.sessionId = match[1];
            console.log("Session ID:", this.sessionId);
            
            // Subscribe to urine tank telemetry
            const subscribe = `control\r\nLS_reqId=${REQUEST_ID}&LS_op=add&LS_subId=${SUBSCRIPTION_ID}&LS_mode=MERGE&LS_group=${TELEMETRY_ITEM}&LS_schema=${TELEMETRY_FIELD}&LS_session=${this.sessionId}\r\n`;
            this.ws.send(subscribe);
          }
        } else if (data.includes(`U,${SUBSCRIPTION_ID},`)) {
          // Update message for our subscription
          const parts = data.split(",");
          if (parts.length >= 3) {
            // Extract the value (skip empty values indicated by $)
            const value = parts[2];
            if (value && value !== "$") {
              this.urineTank = parseFloat(value);
              console.log("Updated Urine Tank Level:", this.urineTank, "%");
            }
          }
        }
      });

      this.ws.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        this.ws = null;
      });

      this.ws.addEventListener("close", () => {
        console.log("WebSocket closed, will reconnect on next request");
        this.ws = null;
        this.sessionId = null;
      });
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
      this.ws = null;
    }
  }

  // Handle Durable Object alarm for keepalive
  async alarm() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send keepalive ping to maintain WebSocket connection
      this.ws.send("\r\n");
    }
    // Schedule next alarm
    await this.state.storage.setAlarm(Date.now() + KEEPALIVE_INTERVAL_MS);
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

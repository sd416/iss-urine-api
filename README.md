# ISS Urine API - Cloudflare Workers Edition

This API provides real-time access to the International Space Station's urine tank telemetry data.

## Overview

This project has been migrated from a traditional Node.js/Express application (running on Render) to a Cloudflare Workers deployment using Durable Objects for maintaining persistent WebSocket connections to NASA's Lightstreamer telemetry feed.

## Architecture

- **Cloudflare Workers**: Serverless edge computing platform for handling API requests
- **Durable Objects**: Maintains a persistent WebSocket connection to NASA's ISS Live Lightstreamer server
- **WebSocket Protocol**: Direct implementation of Lightstreamer protocol over WebSocket for real-time telemetry updates

## Prerequisites

- Node.js 16+ installed
- A Cloudflare account (free tier works)
- Wrangler CLI (installed as dev dependency)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd iss-urine-api
```

2. Install dependencies:
```bash
npm install
```

## Development

### Local Development

Note: Local development with `wrangler dev` may have limitations connecting to external WebSocket services due to network restrictions in the local environment. The application is designed to work when deployed to Cloudflare.

```bash
npm run dev
```

The API will be available at `http://localhost:8787/urine`

### Testing

```bash
curl http://localhost:8787/urine
```

Expected response:
```json
{
  "urineTankPercentage": 85.5
}
```

Or if data hasn't been received yet:
```json
{
  "status": "loading",
  "message": "Telemetry not received yet. Try again in a few seconds."
}
```

## Deployment to Cloudflare

### First-time Setup

1. Login to Cloudflare (if not already logged in):
```bash
npx wrangler login
```

2. Deploy the worker:
```bash
npm run deploy
```

This will:
- Build and upload your worker code
- Create the Durable Object binding
- Provide you with a URL like `https://iss-urine-api.<your-subdomain>.workers.dev`

### Updating the Deployment

After making changes, simply run:
```bash
npm run deploy
```

## API Endpoint

### GET /urine

Returns the current urine tank percentage on the ISS.

**Response (Success - 200):**
```json
{
  "urineTankPercentage": 85.5
}
```

**Response (Loading - 503):**
```json
{
  "status": "loading",
  "message": "Telemetry not received yet. Try again in a few seconds."
}
```

## How It Works

1. **Persistent Connection**: A Cloudflare Durable Object maintains a persistent WebSocket connection to NASA's Lightstreamer server at `wss://push.lightstreamer.com/lightstreamer`

2. **Real-time Updates**: The Durable Object subscribes to telemetry item `NODE3000005` (Urine Tank %) and receives real-time updates

3. **API Requests**: When a request comes to `/urine`, it's routed to the Durable Object which returns the latest cached value

4. **Singleton Pattern**: The Durable Object uses a singleton pattern (`urine-tracker-singleton`) to ensure only one WebSocket connection is maintained globally

## Configuration

The main configuration is in `wrangler.toml`:

```toml
name = "iss-urine-api"
main = "src/index.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[durable_objects]
bindings = [
  { name = "URINE_TRACKER", class_name = "UrineTracker" }
]
```

## Migration from Render

This application was previously running on Render as a traditional Node.js/Express server. The key changes for Cloudflare Workers migration:

1. **Removed Express**: Replaced with native Cloudflare Workers `fetch` handler
2. **Durable Objects**: Used to maintain persistent WebSocket connections (which regular Workers can't do)
3. **Direct WebSocket**: Implemented Lightstreamer protocol directly instead of using the client library (which requires Node.js APIs)
4. **Serverless**: No server to maintain - Cloudflare handles all infrastructure

## Troubleshooting

### WebSocket connection issues

If the WebSocket connection fails, check:
- Cloudflare status page for any outages
- NASA's ISS Live service status

The Durable Object will automatically attempt to reconnect on the next API request.

### Deploy errors

If you encounter "Durable Object not found" errors during deployment:
- Ensure the migration in `wrangler.toml` is configured correctly
- Try deploying with: `npx wrangler deploy --compatibility-date=2024-12-01`

## License

ISC

## Data Source

Telemetry data provided by NASA's ISS Live: https://www.nasa.gov/international-space-station/

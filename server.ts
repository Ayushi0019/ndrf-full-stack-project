import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "ndrf_database.json");

app.use(express.json({ limit: "50mb" }));

// Helper to provide comprehensive initial data for NDRF operations
const getInitialData = () => {
  return {
    resources: [
      { id: 'fwr-1', name: 'Flood Rescue Team 1 (FRT-1)', type: 'team', status: 'active', location: { lat: 26.1158, lng: 91.7086 }, disasterZone: 'Guwahati Sector', lastUpdated: new Date().toISOString() },
      { id: 'fwr-2', name: 'Flood Rescue Team 2 (FRT-2)', type: 'team', status: 'on_standby', location: { lat: 25.5941, lng: 85.1376 }, lastUpdated: new Date().toISOString() },
      { id: 'fwr-3', name: 'Deep Water Rescue Unit 1', type: 'team', status: 'active', location: { lat: 10.8505, lng: 76.2711 }, disasterZone: 'Kerala Coast', lastUpdated: new Date().toISOString() },
      { id: 'fwr-4', name: 'Swift Water Rescue Squad', type: 'team', status: 'on_duty', location: { lat: 30.0869, lng: 78.2676 }, disasterZone: 'Rishikesh Valley', lastUpdated: new Date().toISOString() },

      { id: 'sar-1', name: 'Urban Search & Rescue Team 1 (USAR-1)', type: 'team', status: 'active', location: { lat: 28.6139, lng: 77.2090 }, disasterZone: 'Delhi NCR Response', lastUpdated: new Date().toISOString() },
      { id: 'sar-2', name: 'Collapsed Structure Rescue Team 2 (CSRT-2)', type: 'team', status: 'on_standby', location: { lat: 19.0760, lng: 72.8777 }, lastUpdated: new Date().toISOString() },
      { id: 'sar-3', name: 'Heavy Rescue Unit 1', type: 'vehicle', status: 'maintenance', location: { lat: 22.5726, lng: 88.3639 }, lastUpdated: new Date().toISOString() },
      { id: 'sar-4', name: 'Light Rescue Squad', type: 'team', status: 'on_duty', location: { lat: 13.0827, lng: 80.2707 }, lastUpdated: new Date().toISOString() },

      { id: 'med-1', name: 'Medical Response Team 1 (MRT-1)', type: 'team', status: 'active', location: { lat: 12.9716, lng: 77.5946 }, disasterZone: 'Bangalore Sector', lastUpdated: new Date().toISOString() },
      { id: 'med-2', name: 'Emergency Medical Unit 2', type: 'team', status: 'on_duty', location: { lat: 17.3850, lng: 78.4867 }, lastUpdated: new Date().toISOString() },
      { id: 'med-3', name: 'Trauma Support Team', type: 'team', status: 'on_standby', location: { lat: 23.0225, lng: 72.5714 }, lastUpdated: new Date().toISOString() },
      { id: 'med-4', name: 'Field Medical Squad', type: 'team', status: 'on_standby', location: { lat: 21.1458, lng: 79.0882 }, lastUpdated: new Date().toISOString() },

      { id: 'haz-1', name: 'CBRN Response Team 1', type: 'team', status: 'active', location: { lat: 18.5204, lng: 73.8567 }, disasterZone: 'Pune Industrial Belt', lastUpdated: new Date().toISOString() },
      { id: 'haz-2', name: 'Hazardous Material Unit (HAZMAT-1)', type: 'team', status: 'on_duty', location: { lat: 19.2183, lng: 72.9781 }, lastUpdated: new Date().toISOString() },
      { id: 'haz-3', name: 'Decontamination Squad', type: 'team', status: 'on_standby', location: { lat: 28.4595, lng: 77.0266 }, lastUpdated: new Date().toISOString() },

      { id: 'tech-1', name: 'Communication Support Unit 1', type: 'team', status: 'active', location: { lat: 28.6692, lng: 77.4538 }, disasterZone: 'Ghaziabad Hub', lastUpdated: new Date().toISOString() },
      { id: 'tech-2', name: 'Logistics & Supply Team', type: 'team', status: 'on_duty', location: { lat: 22.7196, lng: 75.8577 }, lastUpdated: new Date().toISOString() },
      { id: 'tech-3', name: 'Equipment Support Squad', type: 'team', status: 'on_standby', location: { lat: 26.8467, lng: 80.9462 }, lastUpdated: new Date().toISOString() },

      { id: 'spec-1', name: 'K9 Search Team 1', type: 'team', status: 'active', location: { lat: 31.1471, lng: 75.3412 }, disasterZone: 'Punjab Frontier', lastUpdated: new Date().toISOString() },
      { id: 'spec-2', name: 'Canine Rescue Unit', type: 'team', status: 'on_standby', location: { lat: 30.3165, lng: 78.0322 }, lastUpdated: new Date().toISOString() },
      { id: 'spec-3', name: 'Deep Diving Team 1', type: 'team', status: 'active', location: { lat: 15.2993, lng: 74.1240 }, disasterZone: 'Goa Coastal Ops', lastUpdated: new Date().toISOString() },
      { id: 'spec-4', name: 'Underwater Search Squad', type: 'team', status: 'on_duty', location: { lat: 20.2376, lng: 86.5366 }, lastUpdated: new Date().toISOString() }
    ],
    users: [
      { uid: 'hq-123', name: 'HQ Commander', email: 'admin@ndrf.gov.in', role: 'hq_admin', createdAt: new Date().toISOString() },
      { uid: 'field-456', name: 'Field Lead Responder', email: 'member@ndrf.gov.in', role: 'field', createdAt: new Date().toISOString() }
    ],
    alerts: [
      { id: 'alt-1', title: 'Severe Cyclone Alert', message: 'Cyclonic storm expected to make landfall in 12 hours.', severity: 'high', disasterZone: 'Odisha Coast', timestamp: new Date().toISOString(), active: true },
      { id: 'alt-2', title: 'Landslide Risk', message: 'Heavy saturation in Soil B-4 indicates imminent risk.', severity: 'critical', disasterZone: 'Chamoli', timestamp: new Date().toISOString(), active: true }
    ],
    requests: [],
    inventory: [
      { id: 'inv-1', name: 'Rescue Boats', category: 'rescue', quantity: 45, unit: 'units', lastUpdated: new Date().toISOString(), minThreshold: 10 },
      { id: 'inv-2', name: 'Medical Kits (Adv)', category: 'medical', quantity: 200, unit: 'kits', lastUpdated: new Date().toISOString(), minThreshold: 50 },
      { id: 'inv-3', name: 'CBRN Decontamination Suits', category: 'specialized', quantity: 120, unit: 'suits', lastUpdated: new Date().toISOString(), minThreshold: 30 },
      { id: 'inv-4', name: 'Life Jackets', category: 'rescue', quantity: 1500, unit: 'units', lastUpdated: new Date().toISOString(), minThreshold: 300 }
    ],
    photos: [],
    incidents: [
      { id: 'inc-1', name: 'Chamoli Valley Ops', type: 'landslide', severity: 'high', epicenter: { lat: 30.7346, lng: 79.0669 }, radiusKm: 15, timestamp: new Date().toISOString(), status: 'active', affectedClusters: ['Joshimath', 'Niti Valley'] },
      { id: 'inc-2', name: 'Coastal Shield Ops', type: 'cyclone', severity: 'critical', epicenter: { lat: 20.2376, lng: 86.5366 }, radiusKm: 120, timestamp: new Date().toISOString(), status: 'active', affectedClusters: ['Paradip', 'Puri'] }
    ],
    logs: [
      { id: 'log-1', message: 'NDRF Portal initialized with independent local database.', level: 'info', timestamp: new Date().toISOString(), resourceId: null, resourceName: 'System Core' }
    ]
  };
};

// Ensure database file is initialized with seed data
const initDatabase = () => {
  if (!fs.existsSync(DB_FILE)) {
    const seed = getInitialData();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf-8");
  }
};

const readDatabase = () => {
  initDatabase();
  try {
    const fileContent = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error("Error reading database file, resetting to default:", error);
    const fallback = getInitialData();
    fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2), "utf-8");
    return fallback;
  }
};

const writeDatabase = (data: any) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error writing to database file:", error);
    return false;
  }
};

// Ensure init on boot
initDatabase();

// API REST Endpoints
app.get("/api/db", (req, res) => {
  const data = readDatabase();
  res.json(data);
});

app.post("/api/db/update", (req, res) => {
  const updates = req.body;
  const currentData = readDatabase();
  
  const mergedData = {
    ...currentData,
    ...updates
  };
  
  if (writeDatabase(mergedData)) {
    res.json({ success: true, data: mergedData });
  } else {
    res.status(500).json({ success: false, error: "Failed to save database metadata" });
  }
});

// Reset endpoint if requested by professor/client
app.post("/api/db/reset", (req, res) => {
  const seed = getInitialData();
  if (writeDatabase(seed)) {
    res.json({ success: true, data: seed });
  } else {
    res.status(500).json({ success: false, error: "Failed to reset database" });
  }
});

// Configure Vite middleware or Static built production files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Fallback all secondary requests to public index.html (SPA Router)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NDRF Portal Backend Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

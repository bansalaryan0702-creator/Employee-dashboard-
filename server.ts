import 'dotenv/config';
import nodemailer from "nodemailer";
import express from "express";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from "vite";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Lazy S3 client initialization
let s3Client: S3Client | null = null;

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "llava";
const GDRIVE_SCRIPT_URL = process.env.GOOGLE_DRIVE_SCRIPT_URL || "";

function getCloudinary() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  return cloudinary;
}

async function cloudinaryUpload(fileBase64: string, folder: string, publicId: string): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;

  const formData = new URLSearchParams();
  formData.append("file", fileBase64);
  formData.append("folder", folder);
  formData.append("public_id", publicId);
  formData.append("upload_preset", "db-backup");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.status} ${errText}`);
  }
  const result = await response.json();
  return result.secure_url;
}

function getS3FileUrl(bucketName: string, key: string): string {
  const endpoint = process.env.S3_ENDPOINT;
  const publicUrl = process.env.S3_PUBLIC_URL;
  if (publicUrl) return `${publicUrl}/${key}`;
  if (endpoint) return `${endpoint}/${bucketName}/${key}`;
  const region = process.env.AWS_REGION || "us-east-1";
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

function getS3Client() {
  if (!s3Client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";
    const endpoint = process.env.S3_ENDPOINT || undefined;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) are missing in environment variables.");
    }

    const config: any = {
      region,
      credentials: { accessKeyId, secretAccessKey }
    };
    if (endpoint) {
      config.endpoint = endpoint;
      config.forcePathStyle = true;
    }

    s3Client = new S3Client(config);
  }
  return s3Client;
}

// Default DB state with fallback to original real-world values from the website
const DEFAULT_DB: any = {
  users: [
    { id: "admin", username: "admin", password: "password123", role: "admin" },
    { id: "2de249bd-5509-4c57-855d-f608efbd708a", username: "Sufiya", password: "Sufiya@123", role: "employee" },
    { id: "67631ad0-ea3c-4fc5-ad57-3e3d69c93ee4", username: "Anand", password: "Anand@123", role: "employee" },
    { id: "6a43a5de-d192-4726-9505-c0ed5fbf43d0", username: "Pradeep", password: "Pradeep@123", role: "employee" },
    { id: "7a3dc4cf-d272-4b3c-acf0-6b52e8f8ec14", username: "Krishna", password: "Krishna@123", role: "employee" },
    { id: "8bc4666c-1e3a-432b-a84b-dce5d8115711", username: "Rajesh", password: "Rajesh@123", role: "employee" },
    { id: "92ebcdb9-c1c8-4077-878e-5e88496ffe86", username: "Wazzer", password: "Wazzer@123", role: "manager" },
    { id: "a0b55f15-9dbb-4be2-88eb-289fcd4b2d61", username: "Sarwar", password: "Sarwar@123", role: "employee" },
    { id: "d2733ef0-b03a-415f-bd16-dbeb9d6a2c4a", username: "Ajay", password: "Ajay@123", role: "employee" },
    { id: "eab4199b-5761-478b-b951-a571c0adbc94", username: "Revanna", password: "Ravanna@123", role: "employee" }
  ],
  tickets: [],
  products: [
    "Colour Printout 18%", "Billbook 1+1 A/5size", "Billbook 1+1 A/4 size", "billbook A/4 1+1",
    "carbon less book 1+2", "register printed 200 pages", "register printed 300 pages",
    "reciept book 1+1", "color printouts A/3", "color printouts A/4", "color printouts A/5",
    "color printouts 4x6\"", "frame gold", "frame black", "danglers", "tent cards",
    "sticker A/3", "sticker A/3 with half cut", "sticker A/3 PVC", "2 wheeler sticker",
    "4 wheeler sticker", "standee 3ftx6ft", "standee 3ftx5ft", "standee Luxury 3Ft x6Ft",
    "Promotable", "Flyers A/5 size", "Flyers A/4 size", "Flyers A/3 size", "Id cards PVC",
    "Id cards Normal", "lamination A/4", "lamination A/3", "Spiralbinding", "wiro binding",
    "lanyards", "Business cards", "letterheads", "Envelopes A/4", "Envelopes  small",
    "Cloth envelope", "paper bags", "Spring files", "SelfInk Stamp", "Star Flex",
    "Normal flex", "Non tearble  Vinyl", "Post Cards", "Invitation cards", "Wedding Cards",
    "IdCard Holders", "yoyo clips round", "yoyo clips Oval", "Certificates", "Trophies Crystal",
    "Trophies Wooden", "Trophies Acyrlic", "Vinyl Posters", "Jute Bags", "Mugs",
    "Badges Metal", "Note book", "Dairies", "Paper folders with Pouch", "Book Marks",
    "key chains", "Sunboard 3MM", "Sunboard 5MM", "ACP board", "Acyrlic Board", "Name paltes",
    "Plastic Pouches", "Hoodies", "Jackets", "Electronic gadgets", "Power banks",
    "Sipper bottles", "Joining Kit", "Sunpack"
  ],
  customers: [
    "Acme Corp", "Tech Solutions Inc", "Global Industries", "Printfield", "Shawarma House",
    "QI Brokerage LLP", "SAP Training Institute", "I-HUB FOR ROBOTICS AND AUTONOMOUS SYSTEMS",
    "herbs and spices", "SANTEWARE HEALTHCARE SOLUTIONS PRIVATE"
  ],
  vendors: [
    "Supra Supplies", "ElectroMart", "FastDelivery", "ky-umar", "SCA", "Sambhav", "First idea",
    "Swissmilitary"
  ],
  catalogueItems: [],
  categories: ["Mugs", "T-Shirts", "Notebooks", "Water Bottles", "Business Cards", "Flyers", "Posters", "Banners"]
};

// Attempt to parse dynamic local-db.json on startup to seed/populate everything perfectly
try {
  const localDbPath = path.join(process.cwd(), "local-db.json");
  if (fs.existsSync(localDbPath)) {
    console.log("Found local-db.json. Parsing and migrating old website data...");
    const localDb = JSON.parse(fs.readFileSync(localDbPath, "utf8"));
    
    if (localDb.users && typeof localDb.users === "object") {
      DEFAULT_DB.users = Object.values(localDb.users).map((u: any) => ({
        id: u.id || uuidv4(),
        username: u.username || "",
        password: u.password || "",
        role: u.role || "employee"
      }));
    }
    
    if (localDb.tickets && typeof localDb.tickets === "object") {
      DEFAULT_DB.tickets = Object.values(localDb.tickets);
    }
    
    if (localDb.metadata && localDb.metadata.lists) {
      const lists = localDb.metadata.lists;
      if (Array.isArray(lists.products)) DEFAULT_DB.products = lists.products;
      if (Array.isArray(lists.customers)) DEFAULT_DB.customers = lists.customers;
      if (Array.isArray(lists.vendors)) DEFAULT_DB.vendors = lists.vendors;
    }
    
    if (localDb.catalogue_items && typeof localDb.catalogue_items === "object") {
      DEFAULT_DB.catalogueItems = Object.values(localDb.catalogue_items).map((item: any) => ({
        id: item.id || uuidv4(),
        name: item.name || "",
        description: item.description || "",
        price: typeof item.sellingPrice === "number" ? item.sellingPrice : (typeof item.price === "number" ? item.price : 0),
        category: item.category || "Uncategorized",
        imageUrl: item.imageUrl || ""
      }));
      const migratedCats = DEFAULT_DB.catalogueItems.map((item: any) => item.category).filter(Boolean);
      DEFAULT_DB.categories = Array.from(new Set([...DEFAULT_DB.categories, ...migratedCats]));
    }
    console.log(`Migration payload constructed: ${DEFAULT_DB.users.length} users, ${DEFAULT_DB.tickets.length} tickets, ${DEFAULT_DB.products.length} products, ${DEFAULT_DB.catalogueItems.length} catalogue items.`);
  }
} catch (e) {
  console.error("Failed to dynamically seed from local-db.json:", e);
}

// Local DB file path
const LOCAL_DB_PATH = path.join(process.cwd(), "local-db.json");

// Read DB from local file (primary) or Cloudinary backup
async function readDB(): Promise<any> {
  let data: any = null;

  // Try local file first
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
    }
  } catch (e) {
    console.error("Failed to read local DB:", e);
  }

  // Try Cloudinary backup if local is empty
  if (!data && process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const c = getCloudinary();
      const result = await c.search.expression("folder:db-backup AND filename:db.json").execute();
      if (result.resources && result.resources.length > 0) {
        const resource = result.resources[0];
        const response = await fetch(resource.secure_url);
        const text = await response.text();
        data = JSON.parse(text);
        console.log("Restored database from Cloudinary backup");
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error("Failed to restore from Cloudinary:", e);
    }
  }

  // Fall back to default
  if (!data) data = DEFAULT_DB;

  // Normalize: convert objects to arrays where needed
  if (data.users && !Array.isArray(data.users)) {
    data.users = Object.values(data.users);
  }
  if (data.tickets && !Array.isArray(data.tickets)) {
    data.tickets = Object.values(data.tickets);
  }
  if (data.catalogueItems && !Array.isArray(data.catalogueItems)) {
    data.catalogueItems = Object.values(data.catalogueItems);
  }

  // Ensure all fields exist
  if (!data.users) data.users = [];
  if (!data.tickets) data.tickets = [];
  if (!data.products) data.products = [];
  if (!data.customers) data.customers = [];
  if (!data.vendors) data.vendors = [];
  if (!data.catalogueItems) data.catalogueItems = [];
  if (!data.categories) data.categories = [];

  // Migrate from old local-db.json format (metadata.lists → top-level)
  if (data.metadata && data.metadata.lists) {
    const lists = data.metadata.lists;
    if (Array.isArray(lists.products) && lists.products.length > 0 && data.products.length === 0) data.products = lists.products;
    if (Array.isArray(lists.customers) && lists.customers.length > 0 && data.customers.length === 0) data.customers = lists.customers;
    if (Array.isArray(lists.vendors) && lists.vendors.length > 0 && data.vendors.length === 0) data.vendors = lists.vendors;
  }

  return data;
}

// Write DB to local file AND backup to Cloudinary
async function writeDB(data: any) {
  // Save locally
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));

  // Backup to Cloudinary
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const base64 = `data:application/json;base64,${Buffer.from(jsonStr).toString("base64")}`;
      const url = await cloudinaryUpload(base64, "db-backup", `db-${Date.now()}`);
      if (url) console.log("Database backed up to Cloudinary:", url);
    } catch (e: any) {
      console.error("Cloudinary backup failed:", e.message);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: "50mb" }));

  // ====== API ROUTES ======

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Serve locally stored files
  app.get("/api/local-file/:filename", (req, res) => {
    const filePath = path.join(process.cwd(), "uploads", req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
    res.sendFile(filePath);
  });

  // File Upload endpoint (Cloudinary → Google Drive → S3 → Local)
  app.post("/api/upload-s3", async (req, res) => {
    try {
      const { fileName, fileType, base64Data } = req.body;

      if (!fileName || !fileType || !base64Data) {
        return res.status(400).json({ error: "fileName, fileType, and base64Data are required" });
      }

      // Priority 1: Cloudinary (free 25GB)
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        try {
          const result = await cloudinary.uploader.upload(
            `data:${fileType};base64,${base64Data}`,
            { folder: "dashboard", public_id: `${Date.now()}-${fileName}` }
          );
          return res.json({ success: true, url: result.secure_url });
        } catch (cloudErr: any) {
          console.error("Cloudinary upload failed, trying next option:", cloudErr.message);
        }
      }

      // Priority 2: Google Drive via Apps Script
      if (GDRIVE_SCRIPT_URL) {
        try {
          const response = await fetch(GDRIVE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ fileName, fileData: base64Data, mimeType: fileType })
          });
          const result = await response.json();
          if (result.success && result.url) {
            return res.json({ success: true, url: result.url });
          }
        } catch (gdriveErr: any) {
          console.error("Google Drive upload failed, trying next option:", gdriveErr.message);
        }
      }

      // Priority 3: S3 / Cloudflare R2
      const bucketName = process.env.AWS_S3_BUCKET_NAME;
      if (bucketName && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const client = getS3Client();
        const buffer = Buffer.from(base64Data, "base64");
        const uniqueFileName = `${uuidv4()}-${fileName}`;
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: `catalog/${uniqueFileName}`,
          Body: buffer,
          ContentType: fileType,
        });
        await client.send(command);
        const fileUrl = getS3FileUrl(bucketName, `catalog/${uniqueFileName}`);
        return res.json({ success: true, url: fileUrl });
      }

      // Priority 4: Local filesystem
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const buffer = Buffer.from(base64Data, "base64");
      const uniqueFileName = `${uuidv4()}-${fileName}`;
      const filePath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(filePath, buffer);
      return res.json({ success: true, url: `/api/local-file/${uniqueFileName}` });
    } catch (error: any) {
      console.error("File upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload file" });
    }
  });

  // Proxy image requests to AWS S3 to bypass 403 Forbidden on private buckets
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).send("URL is required");
      }

      const match = url.match(/https:\/\/([^.]+)\.s3\.[^.]+\.amazonaws\.com\/(.+)/);
      console.log("Proxying image:", url, "Match:", match);
      if (!match) {
        return res.redirect(url);
      }

      const bucketName = match[1];
      const key = decodeURIComponent(match[2]);
      console.log("Bucket:", bucketName, "Key:", key);

      // If S3 is not configured, redirect directly
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return res.redirect(url);
      }

      const client = getS3Client();
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await client.send(command);
      if (response.ContentType) {
        res.setHeader("Content-Type", response.ContentType);
      }
      if (response.CacheControl) {
        res.setHeader("Cache-Control", response.CacheControl);
      } else {
        res.setHeader("Cache-Control", "public, max-age=31536000");
      }
      
      const stream = response.Body as any;
      stream.pipe(res);
    } catch (error: any) {
      console.error("Proxy image error:", error);
      res.status(500).send("Failed to load image");
    }
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
  
    const { username, password } = req.body;
    console.log(`Login attempt for username: "${username}"`);
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const db = await readDB();
    const cleanUsername = username.trim().toLowerCase();
    const user = db.users.find((u: any) => u.username.trim().toLowerCase() === cleanUsername);
    
    if (!user) {
      console.log(`Login failed: User "${cleanUsername}" not found in database. Existing users: ${db.users.map((u: any) => u.username).join(', ')}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.password !== password) {
      console.log(`Login failed: Password mismatch for user "${cleanUsername}"`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    console.log(`Login successful for: ${user.username} (${user.role})`);
    res.json({ user: { id: user.id, username: user.username.trim(), role: user.role } });
  });

  // Admin: Get all employees and managers
  app.get("/api/users", async (req, res) => {
    const db = await readDB();
    const employees = db.users.filter((u: any) => u.role === "employee" || u.role === "manager").map((u: any) => ({
      id: u.id,
      username: u.username.trim(),
      password: u.password,
      role: u.role
    }));
    res.json(employees);
  });

  // Admin: Create employee or manager
  app.post("/api/users", async (req, res) => {
    const { username, password, role } = req.body;
    const db = await readDB();
    const cleanUsername = username.trim();
    if (db.users.some((u: any) => u.username.trim() === cleanUsername)) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const newUserRole = role === 'manager' ? 'manager' : 'employee';
    const newUser = { id: uuidv4(), username: cleanUsername, password, role: newUserRole };
    db.users.push(newUser);
    await writeDB(db);
    res.json({ user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  });

  // Admin: Update employee
  app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;
    const db = await readDB();
    
    const userIndex = db.users.findIndex((u: any) => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    if (username) {
      const cleanUsername = username.trim();
      // Check if another user has this username
      if (db.users.some((u: any) => u.username.trim() === cleanUsername && u.id !== id)) {
        return res.status(400).json({ error: "Username already exists" });
      }
      db.users[userIndex].username = cleanUsername;
    }
    
    if (password) {
      db.users[userIndex].password = password;
    }

    await writeDB(db);
    res.json({ user: { id: db.users[userIndex].id, username: db.users[userIndex].username, role: db.users[userIndex].role } });
  });

  // Admin: Delete employee
  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const db = await readDB();
    
    if (id === 'admin') {
      return res.status(400).json({ error: "Cannot delete admin user" });
    }

    db.users = db.users.filter((u: any) => u.id !== id);
    await writeDB(db);
    res.json({ success: true });
  });

  // Tickets: Get all tickets (Admin)
  app.get("/api/tickets", async (req, res) => {
    const db = await readDB();
    res.json(db.tickets);
  });

  // Tickets: Update ticket
  app.put("/api/tickets/:id", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = await readDB();

    const ticketIndex = db.tickets.findIndex((t: any) => t.id === id);
    if (ticketIndex === -1) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    db.tickets[ticketIndex] = { ...db.tickets[ticketIndex], ...updates };
    await writeDB(db);
    res.json(db.tickets[ticketIndex]);
  });

  // Tickets: Create ticket
  app.post("/api/tickets", async (req, res) => {
    const ticket = req.body;
    const db = await readDB();
    
    // Add any new vendors to global specific lists
    ticket.items.forEach((item: any) => {
      if (item.vendorName && !db.vendors.includes(item.vendorName)) {
        db.vendors.push(item.vendorName);
      }
    });

    if (ticket.customerName && !db.customers.includes(ticket.customerName)) {
      db.customers.push(ticket.customerName);
    }

    const newTicketNumber = db.tickets.length > 0 ? Math.max(...db.tickets.map((t: any) => t.ticketNumber || 0)) + 1 : 1001;
    const newTicket = { ...ticket, id: uuidv4(), ticketNumber: newTicketNumber };
    db.tickets.push(newTicket);
    await writeDB(db);
    res.json(newTicket);
  });

  // Tickets: Delete ticket
  app.delete("/api/tickets/:id", async (req, res) => {
    const { id } = req.params;
    const db = await readDB();
    
    db.tickets = db.tickets.filter((t: any) => t.id !== id);
    await writeDB(db);
    res.json({ success: true });
  });

  // Products: Get list for autocomplete
  app.get("/api/products", async (req, res) => {
    const db = await readDB();
    res.json(db.products);
  });

  // Products: Add new product directly
  app.post("/api/products", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Valid product name is required" });
    }
    const cleanName = name.trim();
    const db = await readDB();
    
    // Case-insensitive check to avoid duplicates
    if (!db.products.some((p: string) => p.toLowerCase() === cleanName.toLowerCase())) {
      db.products.push(cleanName);
      await writeDB(db);
    }
    res.json({ product: cleanName });
  });

  // Products: Update a product
  app.put("/api/products/:name", async (req, res) => {
    const oldName = decodeURIComponent(req.params.name).trim();
    const { name: newName } = req.body;
    
    if (!newName || typeof newName !== 'string' || newName.trim() === '') {
      return res.status(400).json({ error: "Valid new product name is required" });
    }
    const cleanNewName = newName.trim();
    const db = await readDB();
    
    // Check if updating to an existing name (case-insensitive) other than itself
    if (cleanNewName.toLowerCase() !== oldName.toLowerCase() && 
        db.products.some((p: string) => p.toLowerCase().trim() === cleanNewName.toLowerCase())) {
      return res.status(400).json({ error: "Product name already exists" });
    }

    const index = db.products.findIndex((p: string) => p.toLowerCase().trim() === oldName.toLowerCase());
    if (index === -1) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    db.products[index] = cleanNewName;
    await writeDB(db);
    res.json({ success: true, product: cleanNewName });
  });

  // Products: Delete a product
  app.delete("/api/products/:name", async (req, res) => {
    const name = decodeURIComponent(req.params.name).trim();
    const db = await readDB();
    
    const initialLength = db.products.length;
    db.products = db.products.filter((p: string) => p.toLowerCase().trim() !== name.toLowerCase());
    
    if (db.products.length === initialLength) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    await writeDB(db);
    res.json({ success: true });
  });

  // Customers: Get list for autocomplete
  app.get("/api/customers", async (req, res) => {
    const db = await readDB();
    res.json(db.customers);
  });

  // Customers: Add new customer directly
  app.post("/api/customers", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Valid customer name is required" });
    }
    const cleanName = name.trim();
    const db = await readDB();
    
    // Case-insensitive check to avoid duplicates
    if (!db.customers.some((c: string) => c.toLowerCase() === cleanName.toLowerCase())) {
      db.customers.push(cleanName);
      await writeDB(db);
    }
    res.json({ customer: cleanName });
  });

  // Vendors: Get list for autocomplete
  app.get("/api/vendors", async (req, res) => {
    const db = await readDB();
    res.json(db.vendors);
  });

  // Vendors: Add new vendor directly
  app.post("/api/vendors", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Valid vendor name is required" });
    }
    const cleanName = name.trim();
    const db = await readDB();
    
    // Case-insensitive check to avoid duplicates
    if (!db.vendors.some((v: string) => v.toLowerCase() === cleanName.toLowerCase())) {
      db.vendors.push(cleanName);
      await writeDB(db);
    }
    res.json({ vendor: cleanName });
  });

  // ====== CATEGORIES API ======
  // Get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const db = await readDB();
      if (!db.categories) {
        db.categories = ["Mugs", "T-Shirts", "Notebooks", "Water Bottles", "Business Cards", "Flyers", "Posters", "Banners"];
        await writeDB(db);
      }
      const itemCategories = (db.catalogueItems || []).map((item: any) => item.category).filter(Boolean);
      const uniqueCategories = Array.from(new Set([...db.categories, ...itemCategories]));
      res.json(uniqueCategories);
    } catch (error: any) {
      console.error("Failed to get categories:", error);
      res.status(500).json({ error: error.message || "Failed to fetch categories" });
    }
  });

  // Create/Add new category
  app.post("/api/categories", async (req, res) => {
    try {
      const { category } = req.body;
      if (!category || typeof category !== "string") {
        return res.status(400).json({ error: "Category name is required and must be a string" });
      }
      const trimmedCategory = category.trim();
      if (!trimmedCategory) {
        return res.status(400).json({ error: "Category name cannot be empty" });
      }
      const db = await readDB();
      if (!db.categories) {
        db.categories = ["Mugs", "T-Shirts", "Notebooks", "Water Bottles", "Business Cards", "Flyers", "Posters", "Banners"];
      }
      if (!db.categories.some((c: string) => c.toLowerCase() === trimmedCategory.toLowerCase())) {
        db.categories.push(trimmedCategory);
        await writeDB(db);
      }
      res.json({ success: true, category: trimmedCategory });
    } catch (error: any) {
      console.error("Failed to add category:", error);
      res.status(500).json({ error: error.message || "Failed to add category" });
    }
  });

  // ====== CATALOGUE ITEMS API ======
  // Get all catalogue items
  app.get("/api/catalogue-items", async (req, res) => {
    try {
      const db = await readDB();
      res.json(db.catalogueItems || []);
    } catch (error: any) {
      console.error("Failed to get catalogue items:", error);
      res.status(500).json({ error: error.message || "Failed to fetch catalogue items" });
    }
  });

  // Create new catalogue item
  app.post("/api/catalogue-items", async (req, res) => {
    try {
      const item = req.body;
      const db = await readDB();
      if (!db.catalogueItems) db.catalogueItems = [];
      const newItem = {
        id: uuidv4(),
        brandName: item.brandName || "",
        name: item.name || "",
        description: item.description || "",
        price: typeof item.price === "number" ? item.price : 0,
        purchasePrice: typeof item.purchasePrice === "number" ? item.purchasePrice : 0,
        sellingPrice: typeof item.sellingPrice === "number" ? item.sellingPrice : 0,
        gstRate: typeof item.gstRate === "number" ? item.gstRate : 0,
        category: item.category || "Uncategorized",
        imageUrl: item.imageUrl || "",
        sizes: Array.isArray(item.sizes) ? item.sizes : []
      };
      db.catalogueItems.push(newItem);
      await writeDB(db);
      res.json(newItem);
    } catch (error: any) {
      console.error("Failed to create catalogue item:", error);
      res.status(500).json({ error: error.message || "Failed to create catalogue item" });
    }
  });

  // Update catalogue item
  app.put("/api/catalogue-items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = await readDB();
      if (!db.catalogueItems) db.catalogueItems = [];
      const index = db.catalogueItems.findIndex((item: any) => item.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Catalogue item not found" });
      }
      db.catalogueItems[index] = {
        ...db.catalogueItems[index],
        brandName: updates.brandName !== undefined ? updates.brandName : db.catalogueItems[index].brandName,
        name: updates.name !== undefined ? updates.name : db.catalogueItems[index].name,
        description: updates.description !== undefined ? updates.description : db.catalogueItems[index].description,
        price: updates.price !== undefined ? (typeof updates.price === "number" ? updates.price : 0) : db.catalogueItems[index].price,
        purchasePrice: updates.purchasePrice !== undefined ? (typeof updates.purchasePrice === "number" ? updates.purchasePrice : 0) : db.catalogueItems[index].purchasePrice,
        sellingPrice: updates.sellingPrice !== undefined ? (typeof updates.sellingPrice === "number" ? updates.sellingPrice : 0) : db.catalogueItems[index].sellingPrice,
        gstRate: updates.gstRate !== undefined ? (typeof updates.gstRate === "number" ? updates.gstRate : 0) : db.catalogueItems[index].gstRate,
        category: updates.category !== undefined ? updates.category : db.catalogueItems[index].category,
        imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : db.catalogueItems[index].imageUrl,
        sizes: updates.sizes !== undefined ? (Array.isArray(updates.sizes) ? updates.sizes : db.catalogueItems[index].sizes || []) : db.catalogueItems[index].sizes || []
      };
      await writeDB(db);
      res.json(db.catalogueItems[index]);
    } catch (error: any) {
      console.error("Failed to update catalogue item:", error);
      res.status(500).json({ error: error.message || "Failed to update catalogue item" });
    }
  });

  // Delete catalogue item
  app.delete("/api/catalogue-items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDB();
      if (!db.catalogueItems) db.catalogueItems = [];
      db.catalogueItems = db.catalogueItems.filter((item: any) => item.id !== id);
      await writeDB(db);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete catalogue item:", error);
      res.status(500).json({ error: error.message || "Failed to delete catalogue item" });
    }
  });

  // ====== AI CATALOGUE EXTRACTION (PDF/Images → crop, enhance, identify) ======
  app.post("/api/catalogue/ai-extract", upload.array("files", 20), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const allImageBuffers: Buffer[] = [];
      const tmpDir = path.join(process.cwd(), "tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      // 1. Convert all files to image buffers
      for (const file of files) {
        if (file.mimetype === "application/pdf") {
          const tmpPdf = path.join(tmpDir, `upload-${Date.now()}-${Math.random().toString(36).slice(2,8)}.pdf`);
          fs.writeFileSync(tmpPdf, file.buffer);
          try {
            const { execSync } = await import("child_process");
            const pythonPath = process.env.PYTHON_PATH || "python";
            const raw = execSync(`"${pythonPath}" -W ignore "${path.join(process.cwd(), "pdf_to_images.py")}" "${tmpPdf}" 2>NUL`, {
              timeout: 120000, maxBuffer: 100 * 1024 * 1024, windowsHide: true,
            });
            const pages: string[] = JSON.parse(raw.toString().trim());
            pages.forEach(b64 => allImageBuffers.push(Buffer.from(b64, "base64")));
          } catch (e: any) {
            console.error("PDF conversion failed:", e.message);
          } finally {
            try { fs.unlinkSync(tmpPdf); } catch {}
          }
        } else {
          allImageBuffers.push(file.buffer);
        }
      }

      // 2. For each page, detect products using sharp (content-aware crop detection)
      //    Simple approach: each catalogue page = one product unless we can split
      const allCrops: Buffer[] = [];

      for (const imgBuf of allImageBuffers) {
        try {
          const metadata = await sharp(imgBuf).metadata();
          const w = metadata.width || 800;
          const h = metadata.height || 600;

          // Try to detect product regions by finding non-white content areas
          // For a catalogue, each page typically has 1 product with text/branding
          // We'll upscale and crop to get a high-quality product image
          const targetW = 1200;
          const targetH = 900;
          const targetRatio = targetW / targetH;
          const currentRatio = w / h;
          let cropW: number, cropH: number, cropLeft: number, cropTop: number;

          if (currentRatio > targetRatio) {
            cropH = h;
            cropW = Math.round(h * targetRatio);
            cropLeft = Math.round((w - cropW) / 2);
            cropTop = 0;
          } else {
            cropW = w;
            cropH = Math.round(w / targetRatio);
            cropLeft = 0;
            cropTop = Math.round((h - cropH) / 2);
          }

          const cropped = await sharp(imgBuf)
            .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
            .resize(targetW, targetH, { fit: "fill" })
            .jpeg({ quality: 92 })
            .toBuffer();

          allCrops.push(cropped);
        } catch (e) {
          console.error("Crop failed for image, using full:", e);
          const fallback = await sharp(imgBuf).resize(1200, 900, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer();
          allCrops.push(fallback);
        }
      }

      // 3. Upload all crops to Cloudinary and collect info
      const uploadedProducts: any[] = [];

      for (let i = 0; i < allCrops.length; i++) {
        const cropBuf = allCrops[i];
        const cropBase64 = `data:image/jpeg;base64,${cropBuf.toString("base64")}`;
        const fileSizeKB = cropBuf.length / 1024;
        const fileSizeMB = fileSizeKB / 1024;

        let imageUrl = "";
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            imageUrl = await cloudinaryUpload(cropBase64, "catalogue", `crop-${Date.now()}-${i}-${Math.random().toString(36).slice(2,8)}`) || "";
          } catch {}
        }

        uploadedProducts.push({
          imageUrl,
          originalIndex: i,
          fileSizeMB: Math.round(fileSizeMB * 100) / 100,
          name: "",
          description: "",
          colors: [],
        });
      }

      // 4. Use Ollama vision to identify products from images (batch, up to 5 at a time)
      if (uploadedProducts.length > 0) {
        try {
          const batchSize = 5;
          for (let b = 0; b < uploadedProducts.length; b += batchSize) {
            const batch = uploadedProducts.slice(b, b + batchSize);
            // Send first image of batch to vision model for identification
            const firstProduct = batch[0];
            if (firstProduct.imageUrl) {
              const visionPrompt = `Look at this product image from a catalogue. Return ONLY a JSON object (no markdown, no code fences) with these fields:
- "name": short product name (e.g. "Ceramic Mug", "Polo T-Shirt")
- "description": one sentence product description
- "colors": array of color names visible or mentioned (e.g. ["Red", "Blue", "Black"])
- "category": product category (e.g. "Mugs", "Apparel", "Bottles")

If you cannot identify the product, return: {"name": "Product", "description": "Catalogue product", "colors": [], "category": "Uncategorized"}`;

              const visionRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: OLLAMA_VISION_MODEL,
                  messages: [{
                    role: "user",
                    content: visionPrompt,
                    images: [firstProduct.imageUrl]
                  }],
                  stream: false,
                  options: { temperature: 0.3 }
                })
              });

              if (visionRes.ok) {
                const visionData = await visionRes.json();
                const content = visionData.message?.content || "";
                try {
                  // Try to extract JSON from response
                  const jsonMatch = content.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const info = JSON.parse(jsonMatch[0]);
                    // Apply same info to all products in this batch (same catalogue page = same product line)
                    for (const p of batch) {
                      p.name = info.name || "Product";
                      p.description = info.description || "";
                      p.colors = info.colors || [];
                      p.category = info.category || "Uncategorized";
                    }
                  }
                } catch {}
              }
            }
          }
        } catch (e) {
          console.error("Vision identification failed:", e);
          // Products keep empty names — user fills them in UI
        }
      }

      // 5. Group products by name (same product, different colors = one card)
      const grouped = new Map<string, any>();
      for (const p of uploadedProducts) {
        const key = (p.name || "Product").toLowerCase().trim();
        if (grouped.has(key)) {
          const existing = grouped.get(key);
          // Merge images as color variants
          if (p.colors?.length) {
            existing.colors = [...new Set([...existing.colors, ...p.colors])];
          }
          if (!existing.additionalImages) existing.additionalImages = [];
          existing.additionalImages.push(p.imageUrl);
        } else {
          grouped.set(key, { ...p, additionalImages: [] });
        }
      }

      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      res.json({ products: Array.from(grouped.values()) });
    } catch (error: any) {
      console.error("Extraction failed:", error);
      res.status(500).json({ error: error.message || "Extraction failed" });
    }
  });

  // Save extracted products as catalogue items
  app.post("/api/catalogue/ai-save", async (req, res) => {
    try {
      const { products } = req.body;
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "Products array required" });
      }
      const db = await readDB();
      if (!db.catalogueItems) db.catalogueItems = [];
      const saved = [];
      for (const p of products) {
        const item = {
          id: uuidv4(), brandName: p.brandName || "", name: p.name || "Untitled",
          description: p.description || "", price: typeof p.price === "number" ? p.price : 0,
          purchasePrice: typeof p.purchasePrice === "number" ? p.purchasePrice : 0,
          sellingPrice: typeof p.sellingPrice === "number" ? p.sellingPrice : 0,
          gstRate: typeof p.gstRate === "number" ? p.gstRate : 18,
          category: p.category || "Uncategorized", imageUrl: p.imageUrl || "",
          colors: p.colors || [],
        };
        db.catalogueItems.push(item);
        saved.push(item);
      }
      await writeDB(db);
      res.json({ saved, count: saved.length });
    } catch (error: any) {
      console.error("Failed to save:", error);
      res.status(500).json({ error: error.message || "Failed to save" });
    }
  });

  // ====== GEMINI API PRODUCT DESCRIPTION ======
  app.post("/api/generate-description", async (req, res) => {
    const { brandName, name, category } = req.body;
    try {
      if (!name) {
        return res.status(400).json({ error: "Product name is required" });
      }

      const prompt = `Generate a highly creative, engaging, and professional product description for a custom printing/branding and corporate gifting item.
Product Brand: ${brandName || "Unbranded"}
Product Name: ${name}
Product Category: ${category || "Uncategorized"}

Constraints:
- Exactly 2 sentences. No more, no less.
- Do NOT include markdown styling or lists.
- Make it unique and tailormade for this item.
- Start the description with a highly unique, varied first word. Do not use generic starters like "Premium", "Make", "Sleek", or "Elevate".
- Ensure the output text is just the description.`;

      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          options: { temperature: 0.9 }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama responded with status ${response.status}`);
      }

      const data = await response.json();
      const description = data.message?.content?.trim() || "";

      if (!description) {
        throw new Error("Empty response from Ollama");
      }

      res.json({ description });

    } catch (error: any) {
      console.error("Failed to generate description:", error);

      const isConnectionError = error?.message?.includes("ECONNREFUSED") || error?.message?.includes("fetch failed");
      if (isConnectionError) {
        return res.json({
          description: `Introducing the ${brandName ? `${brandName} ` : ''}${name}, a top-tier choice from our ${category || 'general'} collection. Designed with quality and elegance in mind, it's the perfect solution to elevate your brand presence and make a lasting impression in any corporate setting.`,
          warning: "Ollama is not running. Please start Ollama and pull a model: ollama pull llama3.2"
        });
      }

      res.status(500).json({ error: "Failed to generate product description" });
    }
  });

  // ====== EMAIL SENDER ======
  app.post("/api/deliver-message", async (req, res) => {
    try {
      const { to, subject, text, profile, attachment } = req.body;
      if (!to || !subject || !text || !profile) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let emailUser, emailPass;
      if (profile === 'Whitefield Stationers') {
        emailUser = process.env.WHITEFIELD_EMAIL_USER || process.env.EMAIL_USER;
        emailPass = process.env.WHITEFIELD_EMAIL_PASS || process.env.EMAIL_APP_PASSWORD;
      } else {
        emailUser = process.env.PRINTFIELD_EMAIL_USER || process.env.EMAIL_USER;
        emailPass = process.env.PRINTFIELD_EMAIL_PASS || process.env.EMAIL_APP_PASSWORD;
      }

      if (!emailUser || !emailPass) {
        return res.status(500).json({ error: `Email credentials not configured for ${profile}. Please add ${profile.split(' ')[0].toUpperCase()}_EMAIL_USER and ${profile.split(' ')[0].toUpperCase()}_EMAIL_PASS in settings.` });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      console.log('Sending email with user:', emailUser);
      const mailOptions: any = {
        from: emailUser,
        to,
        subject,
        text
      };

      if (attachment && attachment.url && attachment.name) {
        let contentToAttach;
        let isS3 = false;
        const bucketName = process.env.AWS_S3_BUCKET_NAME;
        if (bucketName) {
           const match = attachment.url.match(/https:\/\/([^.]+)\.s3\.[^.]+\.amazonaws\.com\/(.+)/);
           if (match) {
             const key = decodeURIComponent(match[2]);
             const client = getS3Client();
             const command = new GetObjectCommand({ Bucket: match[1], Key: key });
             const response = await client.send(command);
             if (response.Body) {
               const byteArray = await response.Body.transformToByteArray();
               contentToAttach = Buffer.from(byteArray);
               isS3 = true;
             }
           }
        }
        
        if (!isS3 && attachment.url.startsWith('data:')) {
            const base64Data = attachment.url.split(',')[1];
            contentToAttach = Buffer.from(base64Data, 'base64');
        }

        if (contentToAttach) {
           mailOptions.attachments = [
             {
               filename: attachment.name,
               content: contentToAttach,
               contentType: attachment.type
             }
           ];
        }
      }

      const info = await transporter.sendMail(mailOptions);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to send email:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });



  // ====== EXCEL EXPORT & IMPORT ======

  // ====== EMAIL RECIPIENTS ======
  app.get("/api/email-recipients", async (req, res) => {
    try {
      const db = await readDB();
      if (!db.emailRecipients) {
        db.emailRecipients = [];
        await writeDB(db);
      }
      res.json(db.emailRecipients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/email-recipients/bulk", async (req, res) => {
    try {
      const { emails, profile } = req.body;
      const db = await readDB();
      if (!db.emailRecipients) db.emailRecipients = [];
      
      const newEmails = [];
      for (const email of emails) {
        const cleanEmail = email.trim();
        if (cleanEmail && !db.emailRecipients.some(r => r.email === cleanEmail && r.profile === profile)) {
          const newRecord = { id: uuidv4(), email: cleanEmail, profile };
          db.emailRecipients.push(newRecord);
          newEmails.push(newRecord);
        }
      }
      await writeDB(db);
      res.json({ success: true, added: newEmails });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/email-recipients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDB();
      if (db.emailRecipients) {
        db.emailRecipients = db.emailRecipients.filter(r => r.id !== id);
        await writeDB(db);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== VITE MIDDLEWARE ======
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

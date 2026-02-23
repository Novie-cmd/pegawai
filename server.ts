import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists and is writable
const uploadDir = path.join(__dirname, "uploads");
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  fs.accessSync(uploadDir, fs.constants.W_OK);
  console.log(`Upload directory is ready and writable: ${uploadDir}`);
} catch (err) {
  console.error(`Error with upload directory: ${err.message}`);
}

const dbPath = path.join(__dirname, "kepegawaian.db");
console.log(`Initializing database at: ${dbPath}`);
let db: Database.Database;
try {
  db = new Database(dbPath);
  console.log("Database connection successful");
} catch (err) {
  console.error(`Failed to connect to database: ${err.message}`);
  process.exit(1);
}

// Initialize database with new fields
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nip TEXT UNIQUE,
    position TEXT NOT NULL,
    category TEXT NOT NULL,
    division TEXT NOT NULL,
    education TEXT,
    religion TEXT,
    phone TEXT,
    email TEXT,
    doc_ktp TEXT,
    doc_sk_pangkat TEXT,
    doc_sk_berkala TEXT,
    doc_sk_jabatan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add missing columns if table already existed
const columns = db.prepare("PRAGMA table_info(employees)").all();
const columnNames = columns.map((c: any) => c.name);

const expectedColumns = [
  { name: 'education', type: 'TEXT' },
  { name: 'religion', type: 'TEXT' },
  { name: 'doc_ktp', type: 'TEXT' },
  { name: 'doc_sk_pangkat', type: 'TEXT' },
  { name: 'doc_sk_berkala', type: 'TEXT' },
  { name: 'doc_sk_jabatan', type: 'TEXT' }
];

expectedColumns.forEach(col => {
  if (!columnNames.includes(col.name)) {
    try {
      db.exec(`ALTER TABLE employees ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added missing column: ${col.name}`);
    } catch (e) {
      console.error(`Error adding column ${col.name}:`, e);
    }
  }
});

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Hanya file PDF yang diperbolehkan!"));
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use("/uploads", express.static(uploadDir));

  // Health check
  app.get("/api/health", (req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.json({ status: "ok", database: "connected" });
    } catch (err: any) {
      res.status(500).json({ status: "error", database: err.message });
    }
  });

  // API Routes
  app.get("/api/employees", (req, res) => {
    const employees = db.prepare("SELECT * FROM employees ORDER BY created_at DESC").all();
    res.json(employees);
  });

  app.get("/api/employees/stats", (req, res) => {
    const total = db.prepare("SELECT COUNT(*) as count FROM employees").get().count;
    const asn = db.prepare("SELECT COUNT(*) as count FROM employees WHERE category = 'ASN'").get().count;
    const p3k = db.prepare("SELECT COUNT(*) as count FROM employees WHERE category = 'P3K'").get().count;
    res.json({ total, asn, p3k });
  });

  app.post("/api/employees", (req, res, next) => {
    console.log("POST /api/employees hit");
    next();
  }, upload.fields([
    { name: 'doc_ktp', maxCount: 1 },
    { name: 'doc_sk_pangkat', maxCount: 1 },
    { name: 'doc_sk_berkala', maxCount: 1 },
    { name: 'doc_sk_jabatan', maxCount: 1 }
  ]), (req, res) => {
    console.log("POST /api/employees processing body:", req.body);
    const { name, nip, position, category, division, education, religion, phone, email } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    const doc_ktp = files?.doc_ktp?.[0]?.filename || null;
    const doc_sk_pangkat = files?.doc_sk_pangkat?.[0]?.filename || null;
    const doc_sk_berkala = files?.doc_sk_berkala?.[0]?.filename || null;
    const doc_sk_jabatan = files?.doc_sk_jabatan?.[0]?.filename || null;

    // Handle empty NIP as null
    const finalNip = nip === "" ? null : nip;

    try {
      const info = db.prepare(
        "INSERT INTO employees (name, nip, position, category, division, education, religion, phone, email, doc_ktp, doc_sk_pangkat, doc_sk_berkala, doc_sk_jabatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(name, finalNip, position, category, division, education, religion, phone, email, doc_ktp, doc_sk_pangkat, doc_sk_berkala, doc_sk_jabatan);
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (error: any) {
      let message = error.message;
      if (message.includes("UNIQUE constraint failed: employees.nip")) {
        message = "NIP sudah terdaftar. Silakan gunakan NIP lain atau kosongkan jika tidak ada.";
      }
      res.status(400).json({ error: message });
    }
  });

  app.put("/api/employees/:id", upload.fields([
    { name: 'doc_ktp', maxCount: 1 },
    { name: 'doc_sk_pangkat', maxCount: 1 },
    { name: 'doc_sk_berkala', maxCount: 1 },
    { name: 'doc_sk_jabatan', maxCount: 1 }
  ]), (req, res) => {
    const { id } = req.params;
    const { name, nip, position, category, division, education, religion, phone, email } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Handle empty NIP as null
    const finalNip = nip === "" ? null : nip;

    try {
      // Get existing employee to keep old files if new ones aren't uploaded
      const existing = db.prepare("SELECT * FROM employees WHERE id = ?").get();
      
      const doc_ktp = files?.doc_ktp?.[0]?.filename || existing.doc_ktp;
      const doc_sk_pangkat = files?.doc_sk_pangkat?.[0]?.filename || existing.doc_sk_pangkat;
      const doc_sk_berkala = files?.doc_sk_berkala?.[0]?.filename || existing.doc_sk_berkala;
      const doc_sk_jabatan = files?.doc_sk_jabatan?.[0]?.filename || existing.doc_sk_jabatan;

      db.prepare(
        "UPDATE employees SET name = ?, nip = ?, position = ?, category = ?, division = ?, education = ?, religion = ?, phone = ?, email = ?, doc_ktp = ?, doc_sk_pangkat = ?, doc_sk_berkala = ?, doc_sk_jabatan = ? WHERE id = ?"
      ).run(name, finalNip, position, category, division, education, religion, phone, email, doc_ktp, doc_sk_pangkat, doc_sk_berkala, doc_sk_jabatan, id);
      res.json({ success: true });
    } catch (error: any) {
      let message = error.message;
      if (message.includes("UNIQUE constraint failed: employees.nip")) {
        message = "NIP sudah terdaftar. Silakan gunakan NIP lain.";
      }
      res.status(400).json({ error: message });
    }
  });

  app.delete("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM employees WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Catch-all for unmatched /api routes - ensure this is before Vite middleware
  app.all("/api/*", (req, res) => {
    console.log(`[404 API] ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: `Endpoint API tidak ditemukan: ${req.method} ${req.url}`,
      path: req.url,
      method: req.method
    });
  });

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Server Error:", err);
    res.setHeader('Content-Type', 'application/json');
    res.status(err.status || 500).json({
      error: err.message || "Terjadi kesalahan internal pada server.",
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

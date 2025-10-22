require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs").promises;
const path = require("path");

const { pool, initDatabase } = require("./utils/database");
const { getFileType } = require("./utils/fileProcessor");
const { processBookInBackground } = require("./utils/backgroundProcessor");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.post("/process-book", upload.single("file"), async (req, res) => {
  const { userId } = req.body;
  const file = req.file;

  if (!file || !userId) {
    return res.status(400).json({
      error: "Missing required fields: file, userId",
    });
  }

  const name = file.originalname;
  const fileType = getFileType(name);
  const allowedTypes = ["pdf", "docx", "txt"];

  if (!allowedTypes.includes(fileType)) {
    await fs.unlink(file.path);
    return res.status(400).json({
      error: "Only PDF, DOCX, and TXT files are allowed",
    });
  }

  if (file.size > 10 * 1024 * 1024) {
    await fs.unlink(file.path);
    return res.status(400).json({
      error: "File size must be less than 10MB",
    });
  }

  const size = `${(file.size / 1024 / 1024).toFixed(2)} MB`;

  try {
    const result = await pool.query(
      'INSERT INTO "Book" (name, size, type, "processingStatus", "userId") VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, size, fileType, "pro", userId]
    );
    const bookId = result.rows[0].id;

    setImmediate(() => {
      processBookInBackground(bookId, userId, file.path, file.mimetype);
    });

    res.json({
      success: true,
      bookId,
      message: "Book uploaded successfully and processing started",
    });
  } catch (error) {
    console.error("Database error:", error);

    try {
      await fs.unlink(file.path);
    } catch (unlinkError) {
      console.error("Failed to delete uploaded file:", unlinkError);
    }

    res.status(500).json({
      error: "Failed to save book record",
      details: error.message,
    });
  }
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    details: error.message,
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const startServer = async () => {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch(console.error);

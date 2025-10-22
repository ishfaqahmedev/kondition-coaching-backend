const fs = require("fs").promises;
const { pool } = require("./database");
const { extractTextFromFile, chunkText } = require("./fileProcessor");
const { generateEmbeddings } = require("./embeddings");
const { storeInPostgres } = require("./database");

const processBookInBackground = async (bookId, userId, filePath, mimetype) => {
  try {
    const text = await extractTextFromFile(filePath, mimetype);
    const chunks = chunkText(text);

    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbeddings(chunks[i]);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${i}:`, error);
        throw error;
      }
    }

    await storeInPostgres(bookId, userId, chunks, embeddings);

    await pool.query(
      'UPDATE "Book" SET "processingStatus" = \'completed\' WHERE id = $1',
      [bookId]
    );

    await fs.unlink(filePath);
    console.log(`Book ${bookId} processed successfully`);
  } catch (error) {
    console.error(`Processing error for book ${bookId}:`, error);

    await pool.query(
      'UPDATE "Book" SET "processingStatus" = \'failed\' WHERE id = $1',
      [bookId]
    );

    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.error("Failed to delete uploaded file:", unlinkError);
    }
  }
};

module.exports = {
  processBookInBackground,
};
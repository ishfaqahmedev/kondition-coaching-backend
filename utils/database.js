const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : false,
});

const initDatabase = async () => {
  try {
    await pool.query("SELECT NOW()");

    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        original_text TEXT NOT NULL,
        embedding vector(1024) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(
      "CREATE INDEX IF NOT EXISTS embeddings_book_id_idx ON embeddings(book_id)"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS embeddings_user_id_idx ON embeddings(user_id)"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    );
  } catch (error) {
    console.error("Database initialization error:", error);
    console.error(
      "Make sure pgvector extension is available in your PostgreSQL database"
    );
  }
};

const storeInPostgres = async (bookId, userId, chunks, embeddings) => {
  try {
    const client = await pool.connect();
    const batchSize = 100;

    try {
      for (let i = 0; i < chunks.length; i += batchSize) {
        const endIndex = Math.min(i + batchSize, chunks.length);
        const values = [];
        const placeholders = [];

        for (let j = i; j < endIndex; j++) {
          const paramIndex = (j - i) * 6;
          placeholders.push(
            `($${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${
              paramIndex + 4
            }, $${paramIndex + 5}, $${paramIndex + 6})`
          );
          values.push(
            `${bookId}-${j}`,
            bookId,
            userId,
            j,
            chunks[j],
            JSON.stringify(embeddings[j])
          );
        }

        const query = `
          INSERT INTO embeddings (id, book_id, user_id, chunk_index, original_text, embedding)
          VALUES ${placeholders.join(", ")}
          ON CONFLICT (id) DO UPDATE SET
            original_text = EXCLUDED.original_text,
            embedding = EXCLUDED.embedding
        `;

        await client.query(query, values);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    throw new Error(`Failed to store in PostgreSQL: ${error.message}`);
  }
};

module.exports = {
  pool,
  initDatabase,
  storeInPostgres,
};

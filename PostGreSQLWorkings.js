import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testDB() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `);
    console.log("Tables in DB:", res.rows);
    
    // Check first 5 rows from a table
    const data = await client.query("SELECT * FROM your_table LIMIT 5;");
    console.log(data.rows);
  } finally {
    client.release();
  }
}

testDB();
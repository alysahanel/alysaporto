const { pool } = require('../src/config/database');

async function run() {
  try {
    const [before] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'cs' AND department = 'HRGA Legal'"
    );

    const [result] = await pool.execute(
      "UPDATE users SET department = 'CS' WHERE role = 'cs' AND (department IS NULL OR department = '' OR department = 'HRGA Legal')"
    );

    const [after] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'cs' AND department = 'CS'"
    );

    const [rows] = await pool.execute(
      "SELECT id, username, role, department FROM users WHERE role = 'cs' ORDER BY id LIMIT 10"
    );

    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}

run();

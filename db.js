require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  waitForConnections: true,
  connectionLimit: 10,
});

async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        config LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS scheduled_emails (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        template_name VARCHAR(255),
        email_to VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        send_at DATETIME NOT NULL,
        render_config LONGTEXT NOT NULL,
        status ENUM('pending','sent','failed') DEFAULT 'pending',
        error_msg TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await conn.execute(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS instagram_id VARCHAR(64) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS instagram_access_token TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS instagram_token_expires_at DATETIME DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(64) DEFAULT NULL
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS scheduled_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        template_name VARCHAR(255),
        scheduled_at DATETIME NOT NULL,
        render_config LONGTEXT NOT NULL,
        status ENUM('pending','published','failed') DEFAULT 'pending',
        ig_media_id VARCHAR(128),
        ig_post_url VARCHAR(512),
        error_msg TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS public_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT 'Mi Menú',
        slug VARCHAR(32) NOT NULL UNIQUE,
        custom_domain VARCHAR(255) DEFAULT NULL,
        page_count INT DEFAULT 0,
        last_published_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await conn.execute(`
      ALTER TABLE public_links
        ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) DEFAULT NULL
    `);

    // Usuario por defecto hardcodeado
    await conn.execute(
      `INSERT IGNORE INTO users (username, password) VALUES (?, ?)`,
      ["hola", "hola"]
    );

    console.log("✅ DB inicializada correctamente");
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };

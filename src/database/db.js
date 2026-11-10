require('dotenv').config();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const { initializeSchema } = require('./schema');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'premier_league',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;
let initialized = false;

/**
 * Asegura que la base de datos MySQL exista y las tablas estén creadas.
 */
async function ensureDatabaseAndTables() {
  if (initialized) return;

  // 1. Conexión inicial sin seleccionar base de datos para crearla si no existe
  const adminConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  await adminConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await adminConnection.end();

  // 2. Conectar a la base de datos específica y crear el esquema de tablas
  const dbConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  await initializeSchema(dbConnection);

  // 3. Si la tabla está vacía, sembrar automáticamente desde teams.json
  const [rows] = await dbConnection.query('SELECT COUNT(*) as count FROM `teams`');
  if (rows[0].count === 0) {
    console.log(' Base de datos vacía. Sembrando datos iniciales en MySQL...');
    await seedFromInitialJson(dbConnection);
  }

  await dbConnection.end();
  initialized = true;
}

/**
 * Siembra datos desde data/teams.json a MySQL reutilizando la lógica modular
 */
async function seedFromInitialJson(connection) {
  const jsonPath = path.join(__dirname, '..', '..', 'data', 'teams.json');
  if (!fs.existsSync(jsonPath)) return;

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const teams = JSON.parse(rawData);

  // Importamos de forma diferida el helper de guardado relacional
  const { saveRelatedData } = require('../models/team.model');

  for (const t of teams) {
    // 1. Guardar equipo principal en 'teams'
    await connection.query(
      `INSERT INTO \`teams\` (id, slug, nombre, nombre_corto, tla, \`año_fundacion\`, ciudad, url_escudo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         slug = VALUES(slug),
         nombre = VALUES(nombre),
         nombre_corto = VALUES(nombre_corto),
         tla = VALUES(tla),
         \`año_fundacion\` = VALUES(\`año_fundacion\`),
         ciudad = VALUES(ciudad),
         url_escudo = VALUES(url_escudo)`,
      [t.id, t.slug || null, t.nombre, t.nombre_corto, t.tla, t.año_fundacion, t.ciudad, t.url_escudo || null]
    );

    // 2. Guardar sus datos relacionados (estadio, hinchas, palmarés, temporada)
    await saveRelatedData(connection, t.id, t);
  }
}

/**
 * Retorna el pool de conexiones a MySQL.
 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool(config);
  }
  return pool;
}

/**
 * Ejecuta una consulta sobre el pool.
 */
async function query(sql, params) {
  const p = getPool();
  return p.query(sql, params);
}

/**
 * Cierra el pool de conexiones.
 */
async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    initialized = false;
  }
}

module.exports = {
  getPool,
  query,
  ensureDatabaseAndTables,
  seedFromInitialJson,
  closeDb,
};

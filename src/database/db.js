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
 * Siembra datos desde data/teams.json a MySQL
 */
async function seedFromInitialJson(connection) {
  const jsonPath = path.join(__dirname, '..', '..', 'data', 'teams.json');
  if (!fs.existsSync(jsonPath)) return;

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const teams = JSON.parse(rawData);

  for (const t of teams) {
    await connection.query(
      `INSERT INTO \`teams\` (id, nombre, nombre_corto, tla, \`año_fundacion\`, ciudad, url_escudo)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         nombre = VALUES(nombre),
         nombre_corto = VALUES(nombre_corto),
         tla = VALUES(tla),
         \`año_fundacion\` = VALUES(\`año_fundacion\`),
         ciudad = VALUES(ciudad),
         url_escudo = VALUES(url_escudo)`,
      [t.id, t.nombre, t.nombre_corto, t.tla, t.año_fundacion, t.ciudad, t.url_escudo || null]
    );

    if (t.estadio) {
      await connection.query(
        `INSERT INTO \`stadiums\` (team_id, nombre, capacidad, \`año_inauguracion\`, ubicacion)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nombre = VALUES(nombre),
           capacidad = VALUES(capacidad),
           \`año_inauguracion\` = VALUES(\`año_inauguracion\`),
           ubicacion = VALUES(ubicacion)`,
        [t.id, t.estadio.nombre, t.estadio.capacidad, t.estadio.año_inauguracion || null, t.estadio.ubicacion || null]
      );
    }

    if (t.miembros_e_hinchas) {
      await connection.query(
        `INSERT INTO \`members_info\` (team_id, cantidad_miembros_oficiales, apodo)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           cantidad_miembros_oficiales = VALUES(cantidad_miembros_oficiales),
           apodo = VALUES(apodo)`,
        [t.id, t.miembros_e_hinchas.cantidad_miembros_oficiales || 0, t.miembros_e_hinchas.apodo || null]
      );
    }

    if (t.palmares) {
      await connection.query(
        `INSERT INTO \`honours\` (
           team_id, titulos_premier_league, titulos_primera_division,
           copas_fa, copas_efl, titulos_champions_league, titulos_europa_league,
           total_trofeos_principales
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           titulos_premier_league = VALUES(titulos_premier_league),
           titulos_primera_division = VALUES(titulos_primera_division),
           copas_fa = VALUES(copas_fa),
           copas_efl = VALUES(copas_efl),
           titulos_champions_league = VALUES(titulos_champions_league),
           titulos_europa_league = VALUES(titulos_europa_league),
           total_trofeos_principales = VALUES(total_trofeos_principales)`,
        [
          t.id,
          t.palmares.titulos_premier_league || 0,
          t.palmares.titulos_primera_division || 0,
          t.palmares.copas_fa || 0,
          t.palmares.copas_efl || 0,
          t.palmares.titulos_champions_league || 0,
          t.palmares.titulos_europa_league || 0,
          t.palmares.total_trofeos_principales || 0,
        ]
      );
    }

    if (t.info_temporada_actual) {
      await connection.query(
        `INSERT INTO \`season_info\` (team_id, temporada, director_tecnico, capitan, sitio_web)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           director_tecnico = VALUES(director_tecnico),
           capitan = VALUES(capitan),
           sitio_web = VALUES(sitio_web)`,
        [
          t.id,
          t.info_temporada_actual.temporada || '2026/2027',
          t.info_temporada_actual.director_tecnico || null,
          t.info_temporada_actual.capitan || null,
          t.info_temporada_actual.sitio_web || null,
        ]
      );
    }
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

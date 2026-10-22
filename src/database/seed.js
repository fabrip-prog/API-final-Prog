const mysql = require('mysql2/promise');
const { ensureDatabaseAndTables, seedFromInitialJson, getPool, closeDb } = require('./db');

async function seedDatabase() {
  console.log(' Conectando a MySQL (XAMPP)...');
  await ensureDatabaseAndTables();

  const pool = getPool();
  console.log(' Sincronizando datos desde data/teams.json a MySQL...');
  await seedFromInitialJson(pool);

  const [rows] = await pool.query('SELECT COUNT(*) as count FROM `teams`');
  console.log(` Migración completada exitosamente: ${rows[0].count} equipos en MySQL (XAMPP).`);
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error(' Error durante la siembra de la base de datos:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };

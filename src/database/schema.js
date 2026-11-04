/**
 * Inicializa el esquema de tablas en MySQL / MariaDB (XAMPP) con IDs numéricos enteros.
 */
async function initializeSchema(connection) {
  // Comprobar si la tabla `teams` existe con tipo VARCHAR antiguo para migrar a INT
  try {
    const [cols] = await connection.query(`
      SELECT DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'id'
    `);

    if (cols.length > 0 && cols[0].DATA_TYPE !== 'int') {
      console.log('🔄 Detectada versión anterior con IDs de texto. Recreando tablas con IDs numéricos (1, 2, 3...)...');
      await connection.query('DROP TABLE IF EXISTS `season_info`, `honours`, `members_info`, `stadiums`, `teams`;');
    }
  } catch (err) {
    // Si la tabla no existe aún, ignorar
  }

  // Tabla: Equipos (Primary Key numérico entero AUTO_INCREMENT)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`teams\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`slug\` VARCHAR(60) UNIQUE,
      \`nombre\` VARCHAR(150) NOT NULL,
      \`nombre_corto\` VARCHAR(100) NOT NULL,
      \`tla\` VARCHAR(10) NOT NULL UNIQUE,
      \`año_fundacion\` INT NOT NULL,
      \`ciudad\` VARCHAR(100) NOT NULL,
      \`url_escudo\` VARCHAR(255),
      INDEX \`idx_teams_ciudad\` (\`ciudad\`),
      INDEX \`idx_teams_año_fundacion\` (\`año_fundacion\`),
      INDEX \`idx_teams_slug\` (\`slug\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Tabla: Estadios
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`stadiums\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`team_id\` INT NOT NULL UNIQUE,
      \`nombre\` VARCHAR(150) NOT NULL,
      \`capacidad\` INT NOT NULL,
      \`año_inauguracion\` INT,
      \`ubicacion\` VARCHAR(255),
      INDEX \`idx_stadiums_capacidad\` (\`capacidad\`),
      FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Tabla: Miembros e Hinchas
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`members_info\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`team_id\` INT NOT NULL UNIQUE,
      \`cantidad_miembros_oficiales\` INT NOT NULL DEFAULT 0,
      \`apodo\` VARCHAR(100),
      FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Tabla: Palmarés
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`honours\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`team_id\` INT NOT NULL UNIQUE,
      \`titulos_premier_league\` INT DEFAULT 0,
      \`titulos_primera_division\` INT DEFAULT 0,
      \`copas_fa\` INT DEFAULT 0,
      \`copas_efl\` INT DEFAULT 0,
      \`titulos_champions_league\` INT DEFAULT 0,
      \`titulos_europa_league\` INT DEFAULT 0,
      \`total_trofeos_principales\` INT DEFAULT 0,
      INDEX \`idx_honours_trofeos\` (\`total_trofeos_principales\`),
      FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Tabla: Información de Temporada
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`season_info\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`team_id\` INT NOT NULL,
      \`temporada\` VARCHAR(20) NOT NULL,
      \`director_tecnico\` VARCHAR(100),
      \`capitan\` VARCHAR(100),
      \`sitio_web\` VARCHAR(255),
      UNIQUE KEY \`unique_team_season\` (\`team_id\`, \`temporada\`),
      FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

module.exports = { initializeSchema };

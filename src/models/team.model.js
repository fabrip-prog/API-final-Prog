const { query, getPool } = require('../database/db');

/**
 *    devuelve el equipo base en la tabla 'teams' por su ID numérico o código TLA.
 *    Ejemplo SQL: SELECT * FROM teams WHERE id = 1 OR LOWER(tla) = 'ars'
 */
async function findTeam(idOrTla) {
  const [rows] = await query(
    'SELECT * FROM `teams` WHERE id = ? OR LOWER(tla) = LOWER(?) LIMIT 1',
    [idOrTla, idOrTla]
  );
  return rows[0] || null;
}

/**
 *    Busca el estadio en la tabla 'stadiums' usando la clave foránea team_id.
 *    Ejemplo SQL: SELECT * FROM stadiums WHERE team_id = 1
 */
async function getStadium(teamId) {
  const [rows] = await query('SELECT * FROM `stadiums` WHERE team_id = ?', [teamId]);
  const s = rows[0];
  if (!s) return null;
  return {
    nombre: s.nombre,
    capacidad: s.capacidad,
    año_inauguracion: s.año_inauguracion,
    ubicacion: s.ubicacion,
  };
}

/**
 *    Busca la masa social en 'members_info' usando team_id.
 *    Ejemplo SQL: SELECT * FROM members_info WHERE team_id = 1
 */
async function getMembers(teamId) {
  const [rows] = await query('SELECT * FROM `members_info` WHERE team_id = ?', [teamId]);
  const m = rows[0];
  if (!m) return null;
  return {
    cantidad_miembros_oficiales: m.cantidad_miembros_oficiales,
    apodo: m.apodo,
  };
}

/**
 *    Busca el palmarés de títulos en 'honours' usando team_id.
 *    Ejemplo SQL: SELECT * FROM honours WHERE team_id = 1
 */
async function getHonours(teamId) {
  const [rows] = await query('SELECT * FROM `honours` WHERE team_id = ?', [teamId]);
  const h = rows[0];
  if (!h) return null;
  return {
    titulos_premier_league: h.titulos_premier_league,
    titulos_primera_division: h.titulos_primera_division,
    copas_fa: h.copas_fa,
    copas_efl: h.copas_efl,
    titulos_champions_league: h.titulos_champions_league,
    titulos_europa_league: h.titulos_europa_league,
    total_trofeos_principales: h.total_trofeos_principales,
  };
}

/**
 *    Busca la información de la temporada actual en 'season_info' usando team_id.
 *    Ejemplo SQL: SELECT * FROM season_info WHERE team_id = 1
 */
async function getSeason(teamId) {
  const [rows] = await query(
    'SELECT * FROM `season_info` WHERE team_id = ? ORDER BY temporada DESC LIMIT 1',
    [teamId]
  );
  const s = rows[0];
  if (!s) return null;
  return {
    temporada: s.temporada,
    director_tecnico: s.director_tecnico,
    capitan: s.capitan,
    sitio_web: s.sitio_web,
  };
}

/**
 *    Construye el equipo completo uniendo los datos de las 5 tablas en un único objeto JSON.
 */
async function getFullTeam(team) {
  if (!team) return null;

  const [estadio, miembros, palmares, temporada] = await Promise.all([
    getStadium(team.id),
    getMembers(team.id),
    getHonours(team.id),
    getSeason(team.id),
  ]);

  return {
    id: team.id,
    nombre: team.nombre,
    nombre_corto: team.nombre_corto,
    tla: team.tla,
    año_fundacion: team.año_fundacion,
    ciudad: team.ciudad,
    url_escudo: team.url_escudo,
    estadio,
    miembros_e_hinchas: miembros,
    palmares,
    info_temporada_actual: temporada,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FUNCIONES AUXILIARES PARA GUARDAR TABLAS HIJAS (INSERT O UPDATE)
// ═══════════════════════════════════════════════════════════════════════════════

async function saveStadium(connection, teamId, estadio) {
  if (!estadio) return;
  const year = estadio.año_inauguracion ?? estadio.ano_inauguracion ?? null;
  await connection.query(
    `INSERT INTO \`stadiums\` (team_id, nombre, capacidad, \`año_inauguracion\`, ubicacion)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       nombre = VALUES(nombre),
       capacidad = VALUES(capacidad),
       \`año_inauguracion\` = VALUES(\`año_inauguracion\`),
       ubicacion = VALUES(ubicacion)`,
    [teamId, estadio.nombre, Number(estadio.capacidad) || 0, year, estadio.ubicacion || null]
  );
}

async function saveMembers(connection, teamId, miembros) {
  if (!miembros) return;
  await connection.query(
    `INSERT INTO \`members_info\` (team_id, cantidad_miembros_oficiales, apodo)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       cantidad_miembros_oficiales = VALUES(cantidad_miembros_oficiales),
       apodo = VALUES(apodo)`,
    [teamId, Number(miembros.cantidad_miembros_oficiales) || 0, miembros.apodo || null]
  );
}

async function saveHonours(connection, teamId, palmares) {
  if (!palmares) return;
  const pl = Number(palmares.titulos_premier_league) || 0;
  const pd = Number(palmares.titulos_primera_division) || 0;
  const fa = Number(palmares.copas_fa) || 0;
  const efl = Number(palmares.copas_efl) || 0;
  const ucl = Number(palmares.titulos_champions_league) || 0;
  const uel = Number(palmares.titulos_europa_league) || 0;
  const total = palmares.total_trofeos_principales !== undefined
    ? Number(palmares.total_trofeos_principales)
    : (pl + pd + fa + efl + ucl + uel);

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
    [teamId, pl, pd, fa, efl, ucl, uel, total]
  );
}

async function saveSeason(connection, teamId, season) {
  if (!season) return;
  await connection.query(
    `INSERT INTO \`season_info\` (team_id, temporada, director_tecnico, capitan, sitio_web)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       director_tecnico = VALUES(director_tecnico),
       capitan = VALUES(capitan),
       sitio_web = VALUES(sitio_web)`,
    [
      teamId,
      season.temporada || '2026/2027',
      season.director_tecnico || null,
      season.capitan || null,
      season.sitio_web || null,
    ]
  );
}

async function saveRelatedData(connection, teamId, data) {
  await saveStadium(connection, teamId, data.estadio);
  await saveMembers(connection, teamId, data.miembros_e_hinchas);
  await saveHonours(connection, teamId, data.palmares);
  await saveSeason(connection, teamId, data.info_temporada_actual);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODELO DE EQUIPOS (MÉTODOS PÚBLICOS)
// ═══════════════════════════════════════════════════════════════════════════════
const TeamModel = {
  /**
   * Cuenta cuántos equipos hay (con filtro opcional de ciudad).
   */
  async count(queryObj = {}) {
    if (queryObj.city) {
      const [rows] = await query(
        'SELECT COUNT(*) AS total FROM `teams` WHERE LOWER(ciudad) = LOWER(?)',
        [queryObj.city]
      );
      return Number(rows[0]?.total || 0);
    }
    const [rows] = await query('SELECT COUNT(*) AS total FROM `teams`');
    return Number(rows[0]?.total || 0);
  },

  /**
   * [GET /api/teams]
   * Obtiene todos los equipos con sus datos completos.
   * Soporta filtrar por ciudad con ?city=londres o por texto con ?search=texto.
   */
  async findAll(queryObj = {}) {
    let sql = 'SELECT * FROM `teams`';
    const params = [];

    // 1. Filtrar por ciudad si viene en la URL (?city=Londres)
    if (queryObj.city) {
      sql += ' WHERE LOWER(ciudad) = LOWER(?)';
      params.push(queryObj.city);
    }
    // 2. Búsqueda simple por texto (?search=Arsenal)
    else if (queryObj.search) {
      sql += ' WHERE LOWER(nombre) LIKE ? OR LOWER(nombre_corto) LIKE ? OR LOWER(tla) LIKE ?';
      const term = `%${queryObj.search.toLowerCase()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY id ASC';

    // Ejecuta la consulta simple a la tabla 'teams'
    const [teams] = await query(sql, params);

    // Para cada equipo obtenido, trae sus datos completos de estadio, palmarés, hinchas y temporada
    return Promise.all(teams.map((t) => getFullTeam(t)));
  },

  /**
   * [GET /api/teams/:id]
   * Busca un equipo por su ID numérico o código TLA (ej: 1 o 'ARS') con todos sus datos.
   */
  async findByIdOrTla(identifier) {
    const team = await findTeam(identifier);
    if (!team) return null;
    return getFullTeam(team);
  },

  /**
   * Alias de compatibilidad.
   */
  async findByIdOrIdentifier(identifier) {
    return TeamModel.findByIdOrTla(identifier);
  },

  /**
   * Verifica si un código TLA ya existe para evitar duplicados.
   */
  async checkExists(tla, excludeId = null) {
    let sql = 'SELECT id, tla FROM `teams` WHERE LOWER(tla) = LOWER(?)';
    const params = [tla];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(Number(excludeId));
    }

    const [rows] = await query(sql, params);
    return rows[0] || null;
  },

  /**
   * [POST /api/teams]
   * Crea un equipo nuevo guardando en 'teams' y en sus tablas secundarias.
   */
  async create(data) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const slug = data.slug || (data.nombre_corto || data.nombre).toLowerCase().replace(/\s+/g, '-');
      const tla = data.tla.toUpperCase();
      const foundationYear = Number(data.año_fundacion ?? data.ano_fundacion);

      // 1. Insertar en la tabla principal 'teams'
      const [result] = await connection.query(
        'INSERT INTO `teams` (slug, nombre, nombre_corto, tla, `año_fundacion`, ciudad, url_escudo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [slug, data.nombre, data.nombre_corto, tla, foundationYear, data.ciudad, data.url_escudo || null]
      );
      const newTeamId = result.insertId;

      // 2. Guardar en las tablas secundarias (stadiums, members_info, honours, season_info)
      await saveRelatedData(connection, newTeamId, data);

      await connection.commit();
      return TeamModel.findByIdOrTla(newTeamId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * [PUT /api/teams/:id]
   * Actualiza los datos de un equipo existente.
   */
  async update(identifier, data) {
    const existing = await findTeam(identifier);
    if (!existing) return null;

    const teamId = existing.id;
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const tla = data.tla ? data.tla.toUpperCase() : existing.tla;
      const foundationYear = data.año_fundacion ?? data.ano_fundacion ?? existing.año_fundacion;

      // 1. Actualizar la tabla principal 'teams'
      await connection.query(
        'UPDATE `teams` SET nombre = ?, nombre_corto = ?, tla = ?, `año_fundacion` = ?, ciudad = ?, url_escudo = ? WHERE id = ?',
        [
          data.nombre || existing.nombre,
          data.nombre_corto || existing.nombre_corto,
          tla,
          Number(foundationYear),
          data.ciudad || existing.ciudad,
          data.url_escudo !== undefined ? data.url_escudo : existing.url_escudo,
          teamId,
        ]
      );

      // 2. Actualizar o insertar en las tablas secundarias
      await saveRelatedData(connection, teamId, data);

      await connection.commit();
      return TeamModel.findByIdOrTla(teamId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * [DELETE /api/teams/:id]
   * Elimina un equipo por ID o TLA.
   * Por la regla ON DELETE CASCADE de MySQL, se borran automáticamente sus datos en las demás tablas.
   */
  async delete(identifier) {
    const existing = await findTeam(identifier);
    if (!existing) return null;

    await query('DELETE FROM `teams` WHERE id = ?', [existing.id]);
    return existing;
  },


  /**
   * [GET /api/teams/:id/stadium]
   * Obtiene únicamente el estadio del equipo.
   */
  async findStadiumByTeam(identifier) {
    const team = await findTeam(identifier);
    if (!team) return null;

    const estadio = await getStadium(team.id);
    return {
      equipo: team.nombre_corto,
      tla: team.tla,
      estadio,
    };
  },

  /**
   * [GET /api/teams/:id/honours]
   * Obtiene únicamente el palmarés de títulos del equipo.
   */
  async findHonoursByTeam(identifier) {
    const team = await findTeam(identifier);
    if (!team) return null;

    const palmares = await getHonours(team.id);
    return {
      equipo: team.nombre_corto,
      tla: team.tla,
      palmares,
    };
  },

  /**
   * [GET /api/teams/:id/members]
   * Obtiene únicamente la masa social y apodo del equipo.
   */
  async findMembersByTeam(identifier) {
    const team = await findTeam(identifier);
    if (!team) return null;

    const miembros = await getMembers(team.id);
    return {
      equipo: team.nombre_corto,
      tla: team.tla,
      miembros_e_hinchas: miembros,
    };
  },

  /**
   * [GET /api/teams/:id/season o /manager]
   * Obtiene únicamente la información de temporada actual (DT, capitán, sitio web).
   */
  async findSeasonInfoByTeam(identifier) {
    const team = await findTeam(identifier);
    if (!team) return null;

    const season = await getSeason(team.id);
    return {
      equipo: team.nombre_corto,
      tla: team.tla,
      info_temporada_actual: season,
    };
  },
};

TeamModel.saveRelatedData = saveRelatedData;

module.exports = TeamModel;

const { query, getPool } = require('../database/db');

// ── SQL base para consultar equipos con todas sus relaciones ─────────────────
const BASE_TEAM_SELECT = `
  SELECT 
    t.id,
    t.nombre, 
    t.nombre_corto, 
    t.tla, 
    t.\`año_fundacion\`, 
    t.ciudad, 
    t.url_escudo,
    s.nombre AS estadio_nombre, 
    s.capacidad AS estadio_capacidad, 
    s.\`año_inauguracion\` AS estadio_año_inauguracion, 
    s.ubicacion AS estadio_ubicacion,
    m.cantidad_miembros_oficiales AS miembros_cantidad, 
    m.apodo AS miembros_apodo,
    h.titulos_premier_league, 
    h.titulos_primera_division, 
    h.copas_fa, 
    h.copas_efl, 
    h.titulos_champions_league, 
    h.titulos_europa_league, 
    h.total_trofeos_principales,
    si.temporada AS season_temporada, 
    si.director_tecnico AS season_director_tecnico, 
    si.capitan AS season_capitan, 
    si.sitio_web AS season_sitio_web
  FROM \`teams\` t
  LEFT JOIN \`stadiums\` s ON s.team_id = t.id
  LEFT JOIN \`members_info\` m ON m.team_id = t.id
  LEFT JOIN \`honours\` h ON h.team_id = t.id
  LEFT JOIN \`season_info\` si ON si.team_id = t.id
`;

// ── Formateador de fila SQL a la estructura JSON esperada por la API ──────────
function formatTeamRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    nombre: row.nombre,
    nombre_corto: row.nombre_corto,
    tla: row.tla,
    año_fundacion: row.año_fundacion,
    ciudad: row.ciudad,
    url_escudo: row.url_escudo,
    estadio: row.estadio_nombre
      ? {
          nombre: row.estadio_nombre,
          capacidad: row.estadio_capacidad,
          año_inauguracion: row.estadio_año_inauguracion,
          ubicacion: row.estadio_ubicacion,
        }
      : null,
    miembros_e_hinchas:
      row.miembros_apodo !== null || row.miembros_cantidad !== null
        ? {
            cantidad_miembros_oficiales: row.miembros_cantidad ?? 0,
            apodo: row.miembros_apodo,
          }
        : null,
    palmares:
      row.total_trofeos_principales !== null
        ? {
            titulos_premier_league: row.titulos_premier_league ?? 0,
            titulos_primera_division: row.titulos_primera_division ?? 0,
            copas_fa: row.copas_fa ?? 0,
            copas_efl: row.copas_efl ?? 0,
            titulos_champions_league: row.titulos_champions_league ?? 0,
            titulos_europa_league: row.titulos_europa_league ?? 0,
            total_trofeos_principales: row.total_trofeos_principales ?? 0,
          }
        : null,
    info_temporada_actual: row.season_temporada
      ? {
          temporada: row.season_temporada,
          director_tecnico: row.season_director_tecnico,
          capitan: row.season_capitan,
          sitio_web: row.season_sitio_web,
        }
      : null,
  };
}

// ── Helper: construir filtros dinámicos en SQL ────────────────────────────────
function buildFilters(queryObj) {
  const conditions = [];
  const params = [];

  // Búsqueda por texto (nombre, nombre corto, ciudad, apodo)
  if (queryObj.search) {
    conditions.push(`(
      LOWER(t.nombre) LIKE ? OR
      LOWER(t.nombre_corto) LIKE ? OR
      LOWER(t.ciudad) LIKE ? OR
      LOWER(COALESCE(m.apodo, '')) LIKE ?
    )`);
    const term = `%${queryObj.search.toLowerCase()}%`;
    params.push(term, term, term, term);
  }

  // Filtro por ciudad exacta (insensible a mayúsculas)
  if (queryObj.city) {
    conditions.push('LOWER(t.ciudad) = ?');
    params.push(queryObj.city.toLowerCase());
  }

  // Filtro por año de fundación
  if (queryObj.foundation_year) {
    conditions.push('t.`año_fundacion` = ?');
    params.push(Number(queryObj.foundation_year));
  }
  if (queryObj.founded_after) {
    conditions.push('t.`año_fundacion` >= ?');
    params.push(Number(queryObj.founded_after));
  }
  if (queryObj.founded_before) {
    conditions.push('t.`año_fundacion` <= ?');
    params.push(Number(queryObj.founded_before));
  }

  // Filtro por director técnico
  if (queryObj.manager) {
    conditions.push('LOWER(COALESCE(si.director_tecnico, "")) LIKE ?');
    params.push(`%${queryObj.manager.toLowerCase()}%`);
  }

  // Filtro por temporada
  if (queryObj.season) {
    conditions.push('si.temporada = ?');
    params.push(queryObj.season);
  }

  // Filtro por posesión de trofeos
  if (queryObj.has_trophies === 'true') {
    conditions.push('COALESCE(h.total_trofeos_principales, 0) > 0');
  } else if (queryObj.has_trophies === 'false') {
    conditions.push('COALESCE(h.total_trofeos_principales, 0) = 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Ordenamiento (por defecto orden numérico por id 1, 2, 3...)
  let orderClause = 'ORDER BY t.id ASC';
  if (queryObj.sort_by) {
    const direction = queryObj.order === 'desc' ? 'DESC' : 'ASC';
    const sortMapping = {
      id: `t.id ${direction}`,
      name: `LOWER(t.nombre) ${direction}`,
      foundation_year: `t.\`año_fundacion\` ${direction}`,
      capacity: `COALESCE(s.capacidad, 0) ${direction}`,
      trophies: `COALESCE(h.total_trofeos_principales, 0) ${direction}`,
      members: `COALESCE(m.cantidad_miembros_oficiales, 0) ${direction}`,
    };
    if (sortMapping[queryObj.sort_by]) {
      orderClause = `ORDER BY ${sortMapping[queryObj.sort_by]}`;
    }
  }

  return { whereClause, orderClause, params };
}

// ── Helper para generar slug ──────────────────────────────────────────────────
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

// ── Helper para construir consulta de búsqueda por ID numérico o identificador ──
function buildTeamLookup(identifier) {
  const str = String(identifier).trim();
  if (/^\d+$/.test(str)) {
    return {
      where: 't.id = ?',
      params: [Number(str)],
    };
  }
  const text = str.toLowerCase();
  return {
    where: '(LOWER(t.tla) = ? OR LOWER(COALESCE(t.slug, "")) = ?)',
    params: [text, text],
  };
}

// ── Modelo de Equipos (Acceso a Datos / Operaciones CRUD) ──────────────────────
const TeamModel = {
  /**
   * Obtiene la cantidad total de equipos según los filtros aplicados.
   */
  async count(queryObj = {}) {
    const { whereClause, params } = buildFilters(queryObj);
    const countSql = `
      SELECT COUNT(DISTINCT t.id) AS total
      FROM \`teams\` t
      LEFT JOIN \`stadiums\` s ON s.team_id = t.id
      LEFT JOIN \`members_info\` m ON m.team_id = t.id
      LEFT JOIN \`honours\` h ON h.team_id = t.id
      LEFT JOIN \`season_info\` si ON si.team_id = t.id
      ${whereClause}
    `;
    const [countRows] = await query(countSql, params);
    return countRows[0] ? Number(countRows[0].total) : 0;
  },

  /**
   * Obtiene el listado de equipos con relaciones, filtros, orden y paginación (GET).
   */
  async findAll(queryObj = {}, { limit = 20, offset = 0 } = {}) {
    const { whereClause, orderClause, params } = buildFilters(queryObj);
    const dataSql = `
      ${BASE_TEAM_SELECT}
      ${whereClause}
      ${orderClause}
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;
    const [rows] = await query(dataSql, params);
    return rows.map(formatTeamRow);
  },

  /**
   * Busca un equipo por su ID numérico (ej. 1, 2, 3), o secundariamente por TLA / slug (GET).
   */
  async findByIdOrIdentifier(identifier) {
    const { where, params } = buildTeamLookup(identifier);
    const sql = `
      ${BASE_TEAM_SELECT}
      WHERE ${where}
      LIMIT 1
    `;
    const [rows] = await query(sql, params);
    return rows && rows.length > 0 ? formatTeamRow(rows[0]) : null;
  },

  /**
   * Alias retrocompatible de búsqueda.
   */
  async findByIdOrTla(identifier) {
    return TeamModel.findByIdOrIdentifier(identifier);
  },

  /**
   * Comprueba si el código TLA ya existe en otro equipo.
   */
  async checkExists(tla, excludeId = null) {
    let sql = 'SELECT id, tla FROM `teams` WHERE LOWER(tla) = ?';
    const params = [tla.toLowerCase()];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(Number(excludeId));
    }

    const [rows] = await query(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  /**
   * Crea un nuevo equipo con ID numérico autoincremental de forma transaccional (POST).
   */
  async create(data) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const slug = data.slug || generateSlug(data.nombre_corto || data.nombre);
      const tlaUpper = data.tla.toUpperCase();

      const foundationYear = data.año_fundacion !== undefined ? data.año_fundacion : data.ano_fundacion;

      // 1. Inserción en tabla principal `teams` (id autoincremental)
      const [insertResult] = await connection.query(
        `INSERT INTO \`teams\` (slug, nombre, nombre_corto, tla, \`año_fundacion\`, ciudad, url_escudo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          slug,
          data.nombre,
          data.nombre_corto,
          tlaUpper,
          Number(foundationYear),
          data.ciudad,
          data.url_escudo || null,
        ]
      );

      const newTeamId = insertResult.insertId;

      // 2. Inserción en `stadiums` con team_id numérico
      if (data.estadio) {
        const stadiumYear = data.estadio.año_inauguracion !== undefined ? data.estadio.año_inauguracion : data.estadio.ano_inauguracion;
        await connection.query(
          `INSERT INTO \`stadiums\` (team_id, nombre, capacidad, \`año_inauguracion\`, ubicacion)
           VALUES (?, ?, ?, ?, ?)`,
          [
            newTeamId,
            data.estadio.nombre,
            Number(data.estadio.capacidad) || 0,
            stadiumYear ? Number(stadiumYear) : null,
            data.estadio.ubicacion || null,
          ]
        );
      }

      // 3. Inserción en `members_info` con team_id numérico
      if (data.miembros_e_hinchas) {
        await connection.query(
          `INSERT INTO \`members_info\` (team_id, cantidad_miembros_oficiales, apodo)
           VALUES (?, ?, ?)`,
          [
            newTeamId,
            Number(data.miembros_e_hinchas.cantidad_miembros_oficiales) || 0,
            data.miembros_e_hinchas.apodo || null,
          ]
        );
      }

      // 4. Inserción en `honours` con team_id numérico
      if (data.palmares) {
        const p = data.palmares;
        const total =
          (Number(p.titulos_premier_league) || 0) +
          (Number(p.titulos_primera_division) || 0) +
          (Number(p.copas_fa) || 0) +
          (Number(p.copas_efl) || 0) +
          (Number(p.titulos_champions_league) || 0) +
          (Number(p.titulos_europa_league) || 0);

        await connection.query(
          `INSERT INTO \`honours\` (
             team_id, titulos_premier_league, titulos_primera_division,
             copas_fa, copas_efl, titulos_champions_league, titulos_europa_league,
             total_trofeos_principales
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newTeamId,
            Number(p.titulos_premier_league) || 0,
            Number(p.titulos_primera_division) || 0,
            Number(p.copas_fa) || 0,
            Number(p.copas_efl) || 0,
            Number(p.titulos_champions_league) || 0,
            Number(p.titulos_europa_league) || 0,
            p.total_trofeos_principales !== undefined ? Number(p.total_trofeos_principales) : total,
          ]
        );
      }

      // 5. Inserción en `season_info` con team_id numérico
      if (data.info_temporada_actual) {
        const s = data.info_temporada_actual;
        await connection.query(
          `INSERT INTO \`season_info\` (team_id, temporada, director_tecnico, capitan, sitio_web)
           VALUES (?, ?, ?, ?, ?)`,
          [
            newTeamId,
            s.temporada || '2026/2027',
            s.director_tecnico || null,
            s.capitan || null,
            s.sitio_web || null,
          ]
        );
      }

      await connection.commit();
      return TeamModel.findByIdOrIdentifier(newTeamId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Actualiza completamente un equipo por su ID numérico (PUT).
   */
  async update(identifier, data) {
    const existing = await TeamModel.findByIdOrIdentifier(identifier);
    if (!existing) return null;

    const teamId = Number(existing.id);
    const tlaUpper = data.tla ? data.tla.toUpperCase() : existing.tla;

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const updateFoundationYear = data.año_fundacion !== undefined ? data.año_fundacion : data.ano_fundacion;

      // 1. Actualizar tabla principal `teams`
      await connection.query(
        `UPDATE \`teams\`
         SET nombre = ?, nombre_corto = ?, tla = ?, \`año_fundacion\` = ?, ciudad = ?, url_escudo = ?
         WHERE id = ?`,
        [
          data.nombre || existing.nombre,
          data.nombre_corto || existing.nombre_corto,
          tlaUpper,
          updateFoundationYear !== undefined ? Number(updateFoundationYear) : existing.año_fundacion,
          data.ciudad || existing.ciudad,
          data.url_escudo !== undefined ? data.url_escudo : existing.url_escudo,
          teamId,
        ]
      );

      // 2. Actualizar o insertar estadio
      if (data.estadio) {
        const updateStadiumYear = data.estadio.año_inauguracion !== undefined ? data.estadio.año_inauguracion : data.estadio.ano_inauguracion;
        await connection.query(
          `INSERT INTO \`stadiums\` (team_id, nombre, capacidad, \`año_inauguracion\`, ubicacion)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             nombre = VALUES(nombre),
             capacidad = VALUES(capacidad),
             \`año_inauguracion\` = VALUES(\`año_inauguracion\`),
             ubicacion = VALUES(ubicacion)`,
          [
            teamId,
            data.estadio.nombre,
            Number(data.estadio.capacidad) || 0,
            updateStadiumYear ? Number(updateStadiumYear) : null,
            data.estadio.ubicacion || null,
          ]
        );
      }

      // 3. Actualizar o insertar masa social
      if (data.miembros_e_hinchas) {
        await connection.query(
          `INSERT INTO \`members_info\` (team_id, cantidad_miembros_oficiales, apodo)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             cantidad_miembros_oficiales = VALUES(cantidad_miembros_oficiales),
             apodo = VALUES(apodo)`,
          [
            teamId,
            Number(data.miembros_e_hinchas.cantidad_miembros_oficiales) || 0,
            data.miembros_e_hinchas.apodo || null,
          ]
        );
      }

      // 4. Actualizar o insertar palmarés
      if (data.palmares) {
        const p = data.palmares;
        const total =
          (Number(p.titulos_premier_league) || 0) +
          (Number(p.titulos_primera_division) || 0) +
          (Number(p.copas_fa) || 0) +
          (Number(p.copas_efl) || 0) +
          (Number(p.titulos_champions_league) || 0) +
          (Number(p.titulos_europa_league) || 0);

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
            teamId,
            Number(p.titulos_premier_league) || 0,
            Number(p.titulos_primera_division) || 0,
            Number(p.copas_fa) || 0,
            Number(p.copas_efl) || 0,
            Number(p.titulos_champions_league) || 0,
            Number(p.titulos_europa_league) || 0,
            p.total_trofeos_principales !== undefined ? Number(p.total_trofeos_principales) : total,
          ]
        );
      }

      // 5. Actualizar o insertar temporada
      if (data.info_temporada_actual) {
        const s = data.info_temporada_actual;
        const temporada = s.temporada || '2026/2027';
        await connection.query(
          `INSERT INTO \`season_info\` (team_id, temporada, director_tecnico, capitan, sitio_web)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             director_tecnico = VALUES(director_tecnico),
             capitan = VALUES(capitan),
             sitio_web = VALUES(sitio_web)`,
          [
            teamId,
            temporada,
            s.director_tecnico || null,
            s.capitan || null,
            s.sitio_web || null,
          ]
        );
      }

      await connection.commit();
      return TeamModel.findByIdOrIdentifier(teamId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Elimina un equipo por su ID numérico (DELETE).
   */
  async delete(identifier) {
    const existing = await TeamModel.findByIdOrIdentifier(identifier);
    if (!existing) return null;

    await query('DELETE FROM `teams` WHERE id = ?', [existing.id]);
    return existing;
  },

  /**
   * Subrecurso: información del estadio.
   */
  async findStadiumByTeam(identifier) {
    const team = await TeamModel.findByIdOrIdentifier(identifier);
    if (!team) return null;

    const [stadiums] = await query('SELECT * FROM `stadiums` WHERE team_id = ?', [team.id]);
    const stadium = stadiums[0] || null;

    return {
      equipo: team.nombre_corto,
      estadio: stadium
        ? {
            nombre: stadium.nombre,
            capacidad: stadium.capacidad,
            año_inauguracion: stadium.año_inauguracion,
            ubicacion: stadium.ubicacion,
          }
        : null,
    };
  },

  /**
   * Subrecurso: vitrina de trofeos.
   */
  async findHonoursByTeam(identifier) {
    const team = await TeamModel.findByIdOrIdentifier(identifier);
    if (!team) return null;

    const [honoursList] = await query('SELECT * FROM `honours` WHERE team_id = ?', [team.id]);
    const honours = honoursList[0] || null;

    return {
      equipo: team.nombre_corto,
      palmares: honours
        ? {
            titulos_premier_league: honours.titulos_premier_league,
            titulos_primera_division: honours.titulos_primera_division,
            copas_fa: honours.copas_fa,
            copas_efl: honours.copas_efl,
            titulos_champions_league: honours.titulos_champions_league,
            titulos_europa_league: honours.titulos_europa_league,
            total_trofeos_principales: honours.total_trofeos_principales,
          }
        : null,
    };
  },

  /**
   * Subrecurso: datos de la temporada actual.
   */
  async findSeasonInfoByTeam(identifier) {
    const team = await TeamModel.findByIdOrIdentifier(identifier);
    if (!team) return null;

    const [seasons] = await query(
      'SELECT * FROM `season_info` WHERE team_id = ? ORDER BY temporada DESC LIMIT 1',
      [team.id]
    );
    const season = seasons[0] || null;

    return {
      equipo: team.nombre_corto,
      info_temporada_actual: season
        ? {
            temporada: season.temporada,
            director_tecnico: season.director_tecnico,
            capitan: season.capitan,
            sitio_web: season.sitio_web,
          }
        : null,
    };
  },
};

module.exports = TeamModel;

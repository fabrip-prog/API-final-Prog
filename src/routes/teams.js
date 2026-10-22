const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { ApiError } = require('../middleware/errorHandler');

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
    id: row.id,
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

// ── Helper: construir filtros dinámicos en SQL (MySQL) ─────────────────────────
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

  // Ordenamiento
  let orderClause = 'ORDER BY t.id ASC';
  if (queryObj.sort_by) {
    const direction = queryObj.order === 'desc' ? 'DESC' : 'ASC';
    const sortMapping = {
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

// ═══════════════════════════════════════════════════════════════════════════════
//  RUTAS DE EQUIPOS (MySQL / XAMPP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/teams
 * List all teams. Supports search, filters, sorting & pagination.
 */
router.get('/', async (req, res, next) => {
  try {
    const { whereClause, orderClause, params } = buildFilters(req.query);

    // Consulta de conteo total
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
    const total = countRows[0] ? countRows[0].total : 0;

    // Paginación
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const dataSql = `
      ${BASE_TEAM_SELECT}
      ${whereClause}
      ${orderClause}
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    const [rows] = await query(dataSql, params);
    const datos = rows.map(formatTeamRow);

    res.json({
      datos,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        total_paginas: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/teams/:id
 * Get a single team by its slug id or TLA code.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const identifier = req.params.id.toLowerCase();
    const sql = `
      ${BASE_TEAM_SELECT}
      WHERE LOWER(t.id) = ? OR LOWER(t.tla) = ?
      LIMIT 1
    `;
    const [rows] = await query(sql, [identifier, identifier]);

    if (!rows || rows.length === 0) {
      return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
    }

    res.json(formatTeamRow(rows[0]));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/teams/:id/stadium
 * Get only the stadium info for a team.
 */
router.get('/:id/stadium', async (req, res, next) => {
  try {
    const identifier = req.params.id.toLowerCase();
    const [teams] = await query(
      'SELECT id, nombre_corto FROM `teams` WHERE LOWER(id) = ? OR LOWER(tla) = ?',
      [identifier, identifier]
    );

    if (!teams || teams.length === 0) {
      return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
    }

    const team = teams[0];
    const [stadiums] = await query('SELECT * FROM `stadiums` WHERE team_id = ?', [team.id]);
    const stadium = stadiums[0] || null;

    res.json({
      equipo: team.nombre_corto,
      estadio: stadium
        ? {
            nombre: stadium.nombre,
            capacidad: stadium.capacidad,
            año_inauguracion: stadium.año_inauguracion,
            ubicacion: stadium.ubicacion,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/teams/:id/honours
 * Get only the honours / trophy cabinet for a team.
 */
router.get('/:id/honours', async (req, res, next) => {
  try {
    const identifier = req.params.id.toLowerCase();
    const [teams] = await query(
      'SELECT id, nombre_corto FROM `teams` WHERE LOWER(id) = ? OR LOWER(tla) = ?',
      [identifier, identifier]
    );

    if (!teams || teams.length === 0) {
      return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
    }

    const team = teams[0];
    const [honoursList] = await query('SELECT * FROM `honours` WHERE team_id = ?', [team.id]);
    const honours = honoursList[0] || null;

    res.json({
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
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/teams/:id/manager
 * Get current season info (manager, captain, website).
 */
router.get('/:id/manager', async (req, res, next) => {
  try {
    const identifier = req.params.id.toLowerCase();
    const [teams] = await query(
      'SELECT id, nombre_corto FROM `teams` WHERE LOWER(id) = ? OR LOWER(tla) = ?',
      [identifier, identifier]
    );

    if (!teams || teams.length === 0) {
      return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
    }

    const team = teams[0];
    const [seasons] = await query(
      'SELECT * FROM `season_info` WHERE team_id = ? ORDER BY temporada DESC LIMIT 1',
      [team.id]
    );
    const season = seasons[0] || null;

    res.json({
      equipo: team.nombre_corto,
      info_temporada_actual: season
        ? {
            temporada: season.temporada,
            director_tecnico: season.director_tecnico,
            capitan: season.capitan,
            sitio_web: season.sitio_web,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

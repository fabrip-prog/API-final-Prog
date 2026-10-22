const express = require('express');
const router = express.Router();
const { query } = require('../database/db');

// ═══════════════════════════════════════════════════════════════════════════════
//  RUTAS DE ESTADÍSTICAS (MySQL / XAMPP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/stats/cities
 * Teams grouped by city.
 */
router.get('/cities', async (_req, res, next) => {
  try {
    const [rows] = await query('SELECT id, nombre_corto, ciudad FROM `teams` ORDER BY ciudad, nombre_corto');

    const grouped = {};
    rows.forEach((t) => {
      if (!grouped[t.ciudad]) grouped[t.ciudad] = [];
      grouped[t.ciudad].push({ id: t.id, nombre_corto: t.nombre_corto });
    });

    res.json(grouped);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/trophies
 * Teams ranked by total major trophies (descending).
 */
router.get('/trophies', async (_req, res, next) => {
  try {
    const [ranking] = await query(`
      SELECT 
        t.id, 
        t.nombre_corto, 
        COALESCE(h.total_trofeos_principales, 0) AS total_trofeos_principales
      FROM \`teams\` t
      LEFT JOIN \`honours\` h ON h.team_id = t.id
      ORDER BY total_trofeos_principales DESC
    `);

    res.json(ranking);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/stadiums
 * All stadiums ranked by capacity (descending).
 */
router.get('/stadiums', async (_req, res, next) => {
  try {
    const [stadiums] = await query(`
      SELECT 
        t.nombre_corto AS equipo, 
        s.nombre AS estadio, 
        s.capacidad, 
        s.\`año_inauguracion\`
      FROM \`stadiums\` s
      JOIN \`teams\` t ON t.id = s.team_id
      ORDER BY s.capacidad DESC
    `);

    res.json(stadiums);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/overview
 * General league-wide statistics.
 */
router.get('/overview', async (_req, res, next) => {
  try {
    const [teamRows] = await query('SELECT COUNT(*) AS count FROM `teams`');
    const totalTeams = Number(teamRows[0]?.count || 0);

    const [stadiumRows] = await query('SELECT SUM(capacidad) AS total_capacidad FROM `stadiums`');
    const totalCapacity = Number(stadiumRows[0]?.total_capacidad || 0);

    const [memberRows] = await query('SELECT SUM(cantidad_miembros_oficiales) AS total_miembros FROM `members_info`');
    const totalMembers = Number(memberRows[0]?.total_miembros || 0);

    const [oldestRows] = await query(`
      SELECT id, nombre_corto AS nombre, \`año_fundacion\` AS fundado 
      FROM \`teams\` 
      ORDER BY \`año_fundacion\` ASC 
      LIMIT 1
    `);

    const [newestRows] = await query(`
      SELECT id, nombre_corto AS nombre, \`año_fundacion\` AS fundado 
      FROM \`teams\` 
      ORDER BY \`año_fundacion\` DESC 
      LIMIT 1
    `);

    const [largestStadiumRows] = await query(`
      SELECT t.nombre_corto AS equipo, s.nombre AS estadio, s.capacidad
      FROM \`stadiums\` s
      JOIN \`teams\` t ON t.id = s.team_id
      ORDER BY s.capacidad DESC
      LIMIT 1
    `);

    const [seasonRows] = await query('SELECT temporada FROM `season_info` ORDER BY temporada DESC LIMIT 1');
    const temporada = seasonRows[0]?.temporada || '2026/2027';

    res.json({
      temporada,
      total_equipos: totalTeams,
      capacidad_total_estadios: totalCapacity,
      capacidad_promedio_estadios: totalTeams > 0 ? Math.round(totalCapacity / totalTeams) : 0,
      total_miembros_oficiales: totalMembers,
      club_mas_antiguo: oldestRows[0] || null,
      club_mas_nuevo: newestRows[0] || null,
      estadio_mas_grande: largestStadiumRows[0] || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

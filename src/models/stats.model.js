const { query } = require('../database/db');

// Este archivo contiene consultas analíticas que utilizan funciones de
// agregación SQL como COUNT(), SUM() y cláusulas ORDER BY con LIMIT.
const StatsModel = {
  /**
   * [GET] /api/stats/cities
   * Obtiene la lista de equipos ordenados por ciudad para que el controlador
   * los agrupe geográficamente.
   */
  async getCitiesDistribution() {
    const [rows] = await query(
      'SELECT id, nombre_corto, ciudad FROM `teams` ORDER BY ciudad, nombre_corto'
    );
    return rows;
  },

  /**
   * [GET] /api/stats/trophies
   * Ranking de equipos ordenados por cantidad de trofeos de mayor a menor.
   * Usamos COALESCE para que los clubes sin títulos figuren con 0 en vez de null.
   */
  async getTrophyRanking() {
    const [rows] = await query(`
      SELECT 
        t.id, 
        t.nombre_corto, 
        COALESCE(h.total_trofeos_principales, 0) AS total_trofeos_principales
      FROM \`teams\` t
      LEFT JOIN \`honours\` h ON h.team_id = t.id
      ORDER BY total_trofeos_principales DESC
    `);
    return rows;
  },

  /**
   * [GET] /api/stats/stadiums
   * Ranking de estadios ordenados de mayor a menor según su capacidad de espectadores.
   * Usamos JOIN porque cada estadio está vinculado obligatoriamente a un equipo.
   */
  async getStadiumCapacityRanking() {
    const [rows] = await query(`
      SELECT 
        t.nombre_corto AS equipo, 
        s.nombre AS estadio, 
        s.capacidad, 
        s.\`año_inauguracion\`
      FROM \`stadiums\` s
      JOIN \`teams\` t ON t.id = s.team_id
      ORDER BY s.capacidad DESC
    `);
    return rows;
  },

  /**
   * [GET] /api/stats/overview
   * Resumen general y récords cuantitativos de la competición.
   * Ejecuta consultas simples e independientes a cada tabla.
   */
  async getLeagueOverview() {
    // 1. Conteo total de equipos
    const [teamRows] = await query('SELECT COUNT(*) AS count FROM `teams`');
    const totalTeams = Number(teamRows[0]?.count || 0);

    // 2. Suma total de capacidad de todos los estadios
    const [stadiumRows] = await query('SELECT SUM(capacidad) AS total_capacidad FROM `stadiums`');
    const totalCapacity = Number(stadiumRows[0]?.total_capacidad || 0);

    // 3. Suma total de miembros y abonados oficiales
    const [memberRows] = await query('SELECT SUM(cantidad_miembros_oficiales) AS total_miembros FROM `members_info`');
    const totalMembers = Number(memberRows[0]?.total_miembros || 0);

    // 4. Club más antiguo (menor año de fundación)
    const [oldestRows] = await query(`
      SELECT id, nombre_corto AS nombre, \`año_fundacion\` AS fundado 
      FROM \`teams\` 
      ORDER BY \`año_fundacion\` ASC 
      LIMIT 1
    `);

    // 5. Club más reciente (mayor año de fundación)
    const [newestRows] = await query(`
      SELECT id, nombre_corto AS nombre, \`año_fundacion\` AS fundado 
      FROM \`teams\` 
      ORDER BY \`año_fundacion\` DESC 
      LIMIT 1
    `);

    // 6. Estadio de mayor aforo de la liga
    const [largestStadiumRows] = await query(`
      SELECT t.nombre_corto AS equipo, s.nombre AS estadio, s.capacidad
      FROM \`stadiums\` s
      JOIN \`teams\` t ON t.id = s.team_id
      ORDER BY s.capacidad DESC
      LIMIT 1
    `);

    // 7. Nombre de la temporada en curso
    const [seasonRows] = await query('SELECT temporada FROM `season_info` ORDER BY temporada DESC LIMIT 1');
    const temporada = seasonRows[0]?.temporada || '2026/2027';

    // 8. Construcción del objeto de respuesta consolidado
    return {
      temporada,
      total_equipos: totalTeams,
      capacidad_total_estadios: totalCapacity,
      capacidad_promedio_estadios: totalTeams > 0 ? Math.round(totalCapacity / totalTeams) : 0,
      total_miembros_oficiales: totalMembers,
      club_mas_antiguo: oldestRows[0] || null,
      club_mas_nuevo: newestRows[0] || null,
      estadio_mas_grande: largestStadiumRows[0] || null,
    };
  },
};

module.exports = StatsModel;

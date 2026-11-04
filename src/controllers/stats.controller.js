const StatsModel = require('../models/stats.model');

/**
 * Controlador de Estadísticas (Lógica de Negocio y Métricas de Liga)
 */
const StatsController = {
  /**
   * GET /api/stats/cities
   * Obtiene los equipos agrupados por su ciudad.
   */
  async getCities(_req, res, next) {
    try {
      const rows = await StatsModel.getCitiesDistribution();

      const grouped = {};
      rows.forEach((t) => {
        if (!grouped[t.ciudad]) grouped[t.ciudad] = [];
        grouped[t.ciudad].push({ id: t.id, nombre_corto: t.nombre_corto });
      });

      res.json(grouped);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/stats/trophies
   * Obtiene el ranking de equipos por cantidad total de trofeos mayores.
   */
  async getTrophies(_req, res, next) {
    try {
      const ranking = await StatsModel.getTrophyRanking();
      res.json(ranking);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/stats/stadiums
   * Obtiene el ranking de estadios ordenados por capacidad de mayor a menor.
   */
  async getStadiums(_req, res, next) {
    try {
      const stadiums = await StatsModel.getStadiumCapacityRanking();
      res.json(stadiums);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/stats/overview
   * Obtiene el resumen general y récords cuantitativos de la competición.
   */
  async getOverview(_req, res, next) {
    try {
      const overview = await StatsModel.getLeagueOverview();
      res.json(overview);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = StatsController;

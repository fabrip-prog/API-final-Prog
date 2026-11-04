const express = require('express');
const router = express.Router();
const StatsController = require('../controllers/stats.controller');

// ═══════════════════════════════════════════════════════════════════════════════
//  RUTAS DE ESTADÍSTICAS (Rutas ➔ Controlador)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/stats/cities
 * Equipos agrupados por su ciudad geográfica.
 */
router.get('/cities', StatsController.getCities);

/**
 * GET /api/stats/trophies
 * Ranking de equipos ordenados por total de trofeos mayores.
 */
router.get('/trophies', StatsController.getTrophies);

/**
 * GET /api/stats/stadiums
 * Ranking de estadios ordenados de mayor a menor capacidad.
 */
router.get('/stadiums', StatsController.getStadiums);

/**
 * GET /api/stats/overview
 * Resumen cuantitativo y récords generales de la liga.
 */
router.get('/overview', StatsController.getOverview);

module.exports = router;

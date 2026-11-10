const TeamModel = require('../models/team.model');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Controlador de Equipos (Lógica de Negocio y Control de Flujo CRUD)
 */
const TeamsController = {
  /**
   * [GET] /api/teams
   * Obtiene la lista de equipos de la temporada (con filtro opcional de ciudad o búsqueda).
   */
  async getAllTeams(req, res, next) {
    try {
      const datos = await TeamModel.findAll(req.query);

      res.json({
        total: datos.length,
        datos,
        paginacion: {
          total: datos.length,
          pagina: Number(req.query.page) || 1,
          limite: Number(req.query.limit) || datos.length,
          total_paginas: 1,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * [GET] /api/teams/city/:city
   * Obtiene todos los equipos pertenecientes a una ciudad.
   */
  async getTeamsByCity(req, res, next) {
    try {
      const city = req.params.city;
      const datos = await TeamModel.findAll({ city });
      res.json({
        ciudad: city,
        total: datos.length,
        datos,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * [GET] /api/teams/:id
   * Obtiene un equipo específico por su ID slug o código TLA.
   */
  async getTeamById(req, res, next) {
    try {
      const team = await TeamModel.findByIdOrTla(req.params.id);

      if (!team) {
        return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
      }

      res.json(team);
    } catch (err) {
      next(err);
    }
  },

  /**
   * [POST] /api/teams
   * Registra un nuevo equipo en la base de datos (CREATE).
   */
  async createTeam(req, res, next) {
    try {
      const { nombre, nombre_corto, tla, ciudad } = req.body;
      const año_fundacion = req.body.año_fundacion !== undefined ? req.body.año_fundacion : req.body.ano_fundacion;

      // Validación de campos obligatorios
      if (!nombre || !nombre_corto || !tla || año_fundacion === undefined || !ciudad) {
        return next(
          new ApiError(
            400,
            'Campos obligatorios faltantes: nombre, nombre_corto, tla, año_fundacion (o ano_fundacion) y ciudad son requeridos.'
          )
        );
      }

      req.body.año_fundacion = año_fundacion;
      if (req.body.estadio && req.body.estadio.ano_inauguracion !== undefined && req.body.estadio.año_inauguracion === undefined) {
        req.body.estadio.año_inauguracion = req.body.estadio.ano_inauguracion;
      }

      // Validación del código TLA
      if (typeof tla !== 'string' || tla.trim().length !== 3) {
        return next(new ApiError(400, "El código TLA debe ser una cadena de exactamente 3 letras (ej. 'LEE')."));
      }

      // Verificar unicidad de código TLA para evitar conflictos
      const collision = await TeamModel.checkExists(tla);
      if (collision) {
        return next(
          new ApiError(
            409,
            `Conflicto: Ya existe un equipo con el código TLA '${collision.tla}'.`
          )
        );
      }

      const newTeam = await TeamModel.create(req.body);
      res.status(201).json({
        mensaje: 'Equipo creado exitosamente.',
        datos: newTeam,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * [PUT] /api/teams/:id
   * Actualiza completamente los datos de un equipo existente (UPDATE).
   */
  async updateTeam(req, res, next) {
    try {
      const identifier = req.params.id;
      const existing = await TeamModel.findByIdOrTla(identifier);

      if (!existing) {
        return next(new ApiError(404, `Equipo '${identifier}' no encontrado para actualizar.`));
      }

      const { nombre, nombre_corto, tla, ciudad } = req.body;
      const año_fundacion = req.body.año_fundacion !== undefined ? req.body.año_fundacion : req.body.ano_fundacion;

      if (!nombre || !nombre_corto || !tla || año_fundacion === undefined || !ciudad) {
        return next(
          new ApiError(
            400,
            'Campos obligatorios faltantes para actualización total: nombre, nombre_corto, tla, año_fundacion y ciudad.'
          )
        );
      }

      req.body.año_fundacion = año_fundacion;
      if (req.body.estadio && req.body.estadio.ano_inauguracion !== undefined && req.body.estadio.año_inauguracion === undefined) {
        req.body.estadio.año_inauguracion = req.body.estadio.ano_inauguracion;
      }

      if (typeof tla !== 'string' || tla.trim().length !== 3) {
        return next(new ApiError(400, 'El código TLA debe ser de exactamente 3 letras.'));
      }

      // Comprobar colisión de TLA con otros clubes
      const collision = await TeamModel.checkExists(tla, existing.id);
      if (collision) {
        return next(new ApiError(409, `El código TLA '${tla.toUpperCase()}' ya está en uso por otro equipo.`));
      }

      const updatedTeam = await TeamModel.update(identifier, req.body);
      res.json({
        mensaje: 'Equipo actualizado exitosamente.',
        datos: updatedTeam,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * [DELETE] /api/teams/:id
   * Elimina un equipo y todas sus tablas asociadas en cascada (DELETE).
   */
  async deleteTeam(req, res, next) {
    try {
      const identifier = req.params.id;
      const deletedTeam = await TeamModel.delete(identifier);

      if (!deletedTeam) {
        return next(new ApiError(404, `Equipo '${identifier}' no encontrado para eliminar.`));
      }

      res.json({
        mensaje: `Equipo '${deletedTeam.nombre}' (${deletedTeam.tla}) eliminado exitosamente.`,
        id_eliminado: deletedTeam.id,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * [GET] /api/teams/:id/stadium
   * Obtiene la información del estadio de un equipo.
   */
  async getTeamStadium(req, res, next) {
    try {
      const result = await TeamModel.findStadiumByTeam(req.params.id);

      if (!result) {
        return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * [GET] /api/teams/:id/honours
   * Obtiene la vitrina de trofeos de un equipo.
   */
  async getTeamHonours(req, res, next) {
    try {
      const result = await TeamModel.findHonoursByTeam(req.params.id);

      if (!result) {
        return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * [GET] /api/teams/:id/manager
   * Obtiene la información de temporada actual (cuerpo técnico, capitán y sitio web).
   */
  async getTeamManager(req, res, next) {
    try {
      const result = await TeamModel.findSeasonInfoByTeam(req.params.id);

      if (!result) {
        return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * [GET] /api/teams/:id/members
   * Obtiene la cantidad de miembros oficiales y apodo del equipo.
   */
  async getTeamMembers(req, res, next) {
    try {
      const result = await TeamModel.findMembersByTeam(req.params.id);

      if (!result) {
        return next(new ApiError(404, `Equipo '${req.params.id}' no encontrado.`));
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = TeamsController;

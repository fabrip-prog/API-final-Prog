/**
 * Custom error class for API-specific errors.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * 404 handler — catches any route that wasn't matched.
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    error: 'No encontrado',
    mensaje: `La ruta ${req.method} ${req.originalUrl} no existe.`,
  });
}

/**
 * Global error handler middleware.
 */
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  if (statusCode === 500) {
    console.error(' Error no controlado en la API:', err);
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Error interno del servidor' : err.message,
    mensaje:
      statusCode === 500 && process.env.NODE_ENV === 'production'
        ? 'Algo salió mal en el servidor.'
        : err.message || 'Algo salió mal en el servidor.',
  });
}

module.exports = { ApiError, notFoundHandler, errorHandler };

export function errorMiddleware(error, req, res, next) {
  console.error(error);

  const status = error.statusCode || 500;
  const message = error.message || "Erro interno do servidor";

  return res.status(status).json({
    error: true,
    message,
  });
}

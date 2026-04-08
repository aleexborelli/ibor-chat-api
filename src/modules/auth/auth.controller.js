import * as authService from "./auth.service.js";

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  return res.json({ user: req.user });
}

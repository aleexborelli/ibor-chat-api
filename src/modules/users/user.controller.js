import * as userService from "./user.service.js";

export async function list(req, res, next) {
  try {
    const users = await userService.listUsers();
    return res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    return res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const user = await userService.updateUserStatus(
      req.params.id,
      req.body.status
    );

    return res.json(user);
  } catch (error) {
    next(error);
  }
}
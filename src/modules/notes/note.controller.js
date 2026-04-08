import * as noteService from "./note.service.js";

export async function createNote(req, res, next) {
  try {
    const data = await noteService.createNote({
      conversationId: req.params.conversationId,
      userId: req.user.sub,
      body: req.body.body,
    });

    return res.json(data);
  } catch (error) {
    next(error);
  }
}

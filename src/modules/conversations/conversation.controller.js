import * as conversationService from "./conversation.service.js";

export async function list(req, res, next) {
  try {
    const queue = req.query.queue || "all";
    const userId = req.user.id;

    const conversations = await conversationService.listConversations({
      userId,
      queue,
    });

    return res.json(conversations);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const conversation = await conversationService.getConversationById(
      req.params.id
    );

    if (!conversation) {
      return res.status(404).json({
        message: "Conversa não encontrada.",
      });
    }

    return res.json(conversation);
  } catch (error) {
    next(error);
  }
}

export async function listMessages(req, res, next) {
  try {
    const messages = await conversationService.listMessagesByConversationId(
      req.params.id
    );

    return res.json(messages);
  } catch (error) {
    next(error);
  }
}

export async function assume(req, res, next) {
  try {
    console.log("REQ.USER NO ASSUME:", req.user);
    const conversation = await conversationService.assumeConversation({
      conversationId: req.params.id,
      userId: req.user.id,
    });

    return res.json(conversation);
  } catch (error) {
    next(error);
  }
}

export async function close(req, res, next) {
  try {
    const conversation = await conversationService.closeConversation({
      conversationId: req.params.id,
      userId: req.user.id,
    });

    return res.json(conversation);
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const message = await conversationService.sendMessageFromConversation({
      conversationId: req.params.id,
      body: req.body.body,
      userId: req.user.id,
    });

    return res.status(201).json(message);
  } catch (error) {
    next(error);
  }
}
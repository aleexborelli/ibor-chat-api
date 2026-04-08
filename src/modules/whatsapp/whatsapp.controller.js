import * as whatsappService from "./whatsapp.service.js";

export async function getStatus(req, res, next) {
  try {
    const session = await whatsappService.getSessionStatus();
    return res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function getQrCode(req, res, next) {
  try {
    const qrCode = await whatsappService.getCurrentQrCode();
    return res.json({ qrCode });
  } catch (error) {
    next(error);
  }
}

export async function disconnectSession(req, res, next) {
  try {
    await whatsappService.disconnectSession();
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

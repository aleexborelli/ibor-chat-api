import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes.js";
import { errorMiddleware } from "./core/error.middleware.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  return res.json({ status: "ok", service: "visualchat-qr-api" });
});

app.use("/api", routes);
app.use(errorMiddleware);

export default app;

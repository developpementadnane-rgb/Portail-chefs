import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import authRoutes from "./routes/auth";
import attendanceRoutes from "./routes/attendance";
import membershipRoutes from "./routes/membership";
import sessionsRoutes from "./routes/sessions";
import membersRoutes from "./routes/members";
import emailRoutes from "./routes/email";
import galleryRoutes from "./routes/gallery";
import pendingRegistrationsRoutes from "./routes/pendingRegistrations";
import sendMemberDocumentsRoutes from "./routes/sendMemberDocuments";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  // Limite explicite ajoutée pour la galerie (photos/vidéos en base64
  // jusqu'à 50 Mo binaire, donc ~68 Mo une fois encodées). Le défaut
  // Express (100kb) aurait bloqué tout upload sans même arriver au
  // handler de la route.
  app.use(express.json({ type: () => true, limit: "80mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.use("/api/auth", authRoutes);
  app.use("/api/auth", emailRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/membership", membershipRoutes);
  app.use("/api/sessions", sessionsRoutes);
  app.use("/api/members", membersRoutes);
  app.use("/api/gallery", galleryRoutes);
  app.use("/api/pending-registrations", pendingRegistrationsRoutes);
  app.use("/api/members", sendMemberDocumentsRoutes);

  return app;
}

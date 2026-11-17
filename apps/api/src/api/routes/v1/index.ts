import { Router } from "express";
import { API_V1_PREFIX } from "@stylaiize/shared";
import authRoutes from "../auth.routes";
import healthRoutes from "../health.routes";
import chatRoutes from "../chat.routes";
import wardrobeRoutes from "../wardrobe.routes";
import recommendRoutes from "../recommend.routes";
import productRoutes from "../product.routes";
import calendarRoutes from "../calendar.routes";
import packingRoutes from "../packing.routes";
import savedOutfitRoutes from "../saved-outfit.routes";
import tryOnRoutes from "../tryon.routes";
import buildLookRoutes from "../build-look.routes";
import styleProfileRoutes from "../style-profile.routes";
import dashboardRoutes from "../dashboard.routes";
import accountRoutes from "../account.routes";
import adminRoutes from "../admin.routes";
import memoryRoutes from "../memory.routes";
import alertsRoutes from "../alerts.routes";
import sustainabilityRoutes from "../sustainability.routes";
import coupleRoutes from "../couple.routes";
import groupRoutes from "../group.routes";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/wardrobe", wardrobeRoutes);
router.use("/recommend", recommendRoutes);
router.use("/products", productRoutes);
router.use("/calendar", calendarRoutes);
router.use("/packing", packingRoutes);
router.use("/outfits", savedOutfitRoutes);
router.use("/tryon", tryOnRoutes);
router.use("/build-look", buildLookRoutes);
router.use("/style-profile", styleProfileRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/account", accountRoutes);
router.use("/admin", adminRoutes);
router.use("/memory", memoryRoutes);
router.use("/alerts", alertsRoutes);
router.use("/sustainability", sustainabilityRoutes);
router.use("/couple", coupleRoutes);
router.use("/group", groupRoutes);

export function mountV1Router(app: { use: (path: string, router: Router) => void }): void {
  app.use(API_V1_PREFIX, router);
}

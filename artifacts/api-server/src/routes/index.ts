import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import servicesRouter from "./services";
import providersRouter from "./providers";
import requestsRouter from "./requests";
import bookingsRouter from "./bookings";
import paymentsRouter from "./payments";
import customerRouter from "./customer";
import providerRouter from "./provider";
import aiRouter from "./ai";
import uploadsRouter from "./uploads";
import adminRouter from "./admin";
import { rateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

// sensitive endpoints get the strictest limits
router.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 60, message: "Too many authentication attempts. Try again in a few minutes." }));

router.use(healthRouter);
router.use(authRouter);
router.use(servicesRouter);
router.use(providersRouter);
router.use(requestsRouter);
router.use(bookingsRouter);
router.use(paymentsRouter);
router.use(customerRouter);
router.use(providerRouter);
router.use(aiRouter);
router.use(uploadsRouter);
router.use(adminRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import marketRouter from "./market";
import challengesRouter from "./challenges";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(marketRouter);
router.use(challengesRouter);

export default router;

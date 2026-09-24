import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stripeRouter from "./stripe";
import authRouter from "./auth";
import adminRouter from "./admin";
import publicRouter from "./public";
import ssoRouter from "./sso";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stripeRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(publicRouter);
router.use(ssoRouter);

export default router;

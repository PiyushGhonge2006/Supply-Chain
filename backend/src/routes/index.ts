import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shipmentsRouter from "./shipments";
import disruptionsRouter from "./disruptions";
import routesRouter from "./routes-handler";
import warehousesRouter from "./warehouses";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/shipments", shipmentsRouter);
router.use("/disruptions", disruptionsRouter);
router.use("/routes", routesRouter);
router.use("/warehouses", warehousesRouter);
router.use("/analytics", analyticsRouter);

export default router;

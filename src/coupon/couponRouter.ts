import express from "express";
import authenticate from "../common/middleware/authenticate";
import { asyncWrapper } from "../utils";
import { CouponController } from "./couponController";
import { CouponService } from "./couponService";

const router = express.Router();
const couponService = new CouponService()
const couponController = new CouponController(couponService);
router.post("/", authenticate, asyncWrapper(couponController.create));
router.post("/verify", authenticate, asyncWrapper(couponController.verify));

router.get("/", authenticate, asyncWrapper(couponController.getAll));
router.put("/:id", authenticate, asyncWrapper(couponController.update));
router.delete("/:id", authenticate, asyncWrapper(couponController.delete));

export default router;
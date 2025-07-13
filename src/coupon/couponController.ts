import { NextFunction, Request, Response } from "express";
import couponModel from "./couponModel";
import createHttpError from "http-errors";

import { Coupon, Filter } from "./couponTypes";
import { CouponService } from "./couponService";

export class CouponController {
  constructor(private couponService: CouponService) {}
  create = async (req: Request, res: Response) => {
    const { title, code, validUpto, discount, tenantId } = req.body;

    // todo: add request validation.
    // todo: check if creator is admin or a manger of that restaurant.

    // todo: add logging
    const coupon = await couponModel.create({
      title,
      code,
      discount,
      validUpto,
      tenantId,
    });

    return res.json(coupon);
  };

  getAll = async (req: Request, res: Response) => {
    const { q, tenantId } = req.query;

    const filters: Filter = {};


    if (tenantId) filters.tenantId = tenantId as string;

    const coupons = await this.couponService.getCoupons(q as string, filters, {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    });
   
    const finalCoupons = (coupons.data as Coupon[]).map((coupon) => {
       return {
        ...coupon
       }
    })

    res.json({
      data: finalCoupons,
      total: coupons.total,
      pageSize: coupons.limit,
      currentPage: coupons.page,
    });
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { title, code, validUpto, discount, tenantId } = req.body;

    const coupon = await couponModel.findByIdAndUpdate(
      id,
      { title, code, validUpto, discount, tenantId },
      { new: true },
    );

    if (!coupon) {
      return next(createHttpError(404, "Coupon not found"));
    }

    return res.json(coupon);
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const coupon = await couponModel.findByIdAndDelete(id);

    if (!coupon) {
      return next(createHttpError(404, "Coupon not found"));
    }

    return res.json({ message: "Coupon deleted successfully" });
  };

  verify = async (req: Request, res: Response, next: NextFunction) => {
    const { code, tenantId } = req.body;

    // todo: request validation

    // todo: add service layer with dependency injection.
    const coupon = await couponModel.findOne({ code, tenantId });

    if (!coupon) {
      const error = createHttpError(400, "Coupon does not exists");
      return next(error);
    }

    // validate expiry
    const currentDate = new Date();
    const couponDate = new Date(coupon.validUpto);

    if (currentDate <= couponDate) {
      return res.json({ valid: true, discount: coupon.discount });
    }

    return res.json({ valid: false, discount: 0 });
  };
}

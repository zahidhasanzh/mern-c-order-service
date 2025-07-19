import { NextFunction, Request, Response } from "express";
import { Request as AuthRequest } from "express-jwt";
import {
  CartItem,
  ProductPricingCache,
  Topping,
  ToppingPriceCache,
} from "../types";
import productCacheModel from "../productCache/productCacheModel";
import toppingCacheModel from "../toppingCache/toppingCacheModel";
import couponModel from "../coupon/couponModel";
import orderModel from "./orderModel";
import { OrderStatus, PaymentMode, PaymentStatus } from "./orderTypes";
import idempotencyModel from "../itempotency/idempotencyModel";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import { PaymentGW } from "../payment/paymentType";
import { MessageBroker } from "../types/broker";
import customerModel from "../customer/customerModel";

export class OrderController {
  constructor(
    private paymentGw: PaymentGW,
    private broker: MessageBroker,
  ) {}
  create = async (req: Request, res: Response, next: NextFunction) => {
    const {
      cart,
      couponCode,
      tenantId,
      paymentMode,
      customerId,
      comment,
      address,
    } = req.body;

    const totalPrice = await this.calculateTotal(cart);
    let discountPercentage = 0;

    if (couponCode) {
      discountPercentage = await this.getDiscountPercentage(
        couponCode,
        tenantId,
      );
    }

    const discountAmount = Math.round((totalPrice * discountPercentage) / 100);

    const priceAfterDicount = totalPrice - discountAmount;
    const TAXES_PERCENT = 15;
    const DELIVERY_CHARGES = 2;

    const taxes = Math.round((priceAfterDicount * TAXES_PERCENT) / 100);
    const finalTotal = priceAfterDicount + taxes + DELIVERY_CHARGES;

    const idempotencyKey = req.headers["idempotency-key"];

    const idempotency = await idempotencyModel.findOne({ key: idempotencyKey });

    let newOrder = idempotency ? [idempotency.response] : [];

    if (!idempotency) {
      const session = await mongoose.startSession();
      await session.startTransaction();

      try {
        //create order
        newOrder = await orderModel.create(
          [
            {
              cart,
              address,
              comment,
              customerId,
              deliveryCharges: DELIVERY_CHARGES,
              discount: discountAmount,
              taxes,
              tenantId,
              total: finalTotal,
              paymentMode,
              orderStatus: OrderStatus.RECEIVED,
              paymentStatus: PaymentStatus.PENDING,
            },
          ],
          { session },
        );

        await idempotencyModel.create(
          [{ key: idempotencyKey, response: newOrder[0] }],
          { session },
        );

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        await session.endSession();

        return next(createHttpError(500, error.message));
      } finally {
        await session.endSession();
      }
    }

    // Payment processing...
    // todo: Error handling
    // todo: add logging
    if (paymentMode === PaymentMode.CARD) {
      const session = await this.paymentGw.createSession({
        amount: finalTotal,
        orderId: newOrder[0]._id.toString(),
        tenantId: tenantId,
        currency: "usd",
        idempotenencyKey: idempotencyKey as string,
      });

      await this.broker.sendMessage("order", JSON.stringify(newOrder));

      return res.json({ paymentUrl: session.paymentUrl });
    }

    await this.broker.sendMessage("order", JSON.stringify(newOrder));
    // todo: update order document -> paymentId -> sessionId
    return res.json({ paymentUrl: null });
  };

  getMine = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.auth.sub;
    if (!userId) {
      return next(createHttpError(400, "No userId found."));
    }
    // todo: Add error handling
    const customer = await customerModel.findOne({ userId });

    if (!customer) {
      return next(createHttpError(400, "No customer found."));
    }

    // todo: implement pagination.
    const orders = await orderModel.find(
      { customerId: customer._id },
      { cart: 0 },
    );
    return res.json(orders);
  };

  getSingle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const orderId = req.params.orderId;
  const { sub: userId, role, tenant: tenantId } = req.auth;


  const orderForAuth = await orderModel.findById(orderId);

  if (!orderForAuth) {
    return next(createHttpError(400, "Order does not exist."));
  }


  if (role === "admin") {
    // pass
  } else if (role === "manager") {
    if (orderForAuth.tenantId !== tenantId) {
      return next(createHttpError(403, "Operation not permitted"));
    }
  } else if (role === "customer") {
    const customer = await customerModel.findOne({ userId });
    if (!customer || orderForAuth.customerId?.toString() !== customer._id.toString()) {
      return next(createHttpError(403, "Operation not permitted"));
    }
  } else {
    return next(createHttpError(403, "Operation not permitted"));
  }

  const rawFields = req.query.fields?.toString() || "";
  const fields = rawFields.split(",").filter(Boolean);

  const selectFields = fields.join(" ");

  const order = await orderModel
    .findById(orderId)
    .select(selectFields)
    .lean();

  return res.json(order);
};




  private calculateTotal = async (cart: CartItem[]) => {
    const productIds = cart.map((item) => item._id);
    const productPricings = await productCacheModel.find({
      productId: {
        $in: productIds,
      },
    });

    const cartToppingIds = cart.reduce((acc, item) => {
      return [
        ...acc,
        ...item.chosenConfiguration.selectedToppings.map(
          (topping) => topping.id,
        ),
      ];
    }, []);

    const toppingPricings = await toppingCacheModel.find({
      toppingId: {
        $in: cartToppingIds,
      },
    });

    const totalPrice = cart.reduce((acc, curr) => {
      const cachedProductPrice = productPricings.find(
        (product) => product.productId === curr._id,
      );
      return (
        acc +
        curr.qty * this.getItemTotal(curr, cachedProductPrice, toppingPricings)
      );
    }, 0);

    return totalPrice;
  };

  private getItemTotal = (
    item: CartItem,
    cachedProductPrice: ProductPricingCache,
    toppingsPricings: ToppingPriceCache[],
  ) => {
    const toppingsTotal = item.chosenConfiguration.selectedToppings.reduce(
      (acc, curr) => {
        return acc + this.getCurrentToppingPrice(curr, toppingsPricings);
      },
      0,
    );

    const productTotal = Object.entries(
      item.chosenConfiguration.priceConfiguration,
    ).reduce((acc, [key, value]) => {
      const price =
        cachedProductPrice.priceConfiguration[key].availableOptions[value];
      return acc + price;
    }, 0);
    return productTotal + toppingsTotal;
  };

  private getCurrentToppingPrice = (
    topping: Topping,
    toppingPricings: ToppingPriceCache[],
  ) => {
    const currentTopping = toppingPricings.find(
      (current) => topping.id === current.toppingId,
    );

    if (!currentTopping) {
      // todo: Make sure the item is in cache else, maybe call catelog service
      return topping.price;
    }
    return currentTopping.price;
  };

  private getDiscountPercentage = async (
    couponCode: string,
    tenantId: string,
  ) => {
    const code = await couponModel.findOne({ code: couponCode, tenantId });
    if (!code) {
      return 0;
    }
    const currentDate = new Date();
    const couponDate = new Date(code.validUpto);

    if (currentDate <= couponDate) {
      return code.discount;
    }
    return 0;
  };
}

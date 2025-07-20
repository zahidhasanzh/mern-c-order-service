import { Request, Response } from "express";
import { PaymentGW } from "./paymentType";
import orderModel from "../order/orderModel";
import { OrderEvents, PaymentStatus } from "../order/orderTypes";
import { MessageBroker } from "../types/broker";

export class PaymentController {
  constructor(
    private paymentGw: PaymentGW,
    private broker: MessageBroker,
  ) {}
  handleWebhook = async (req: Request, res: Response) => {
    const webhookBody = req.body;
    console.log(req.body);

    if (webhookBody.type === "checkout.session.completed") {
      const verifiedSession = await this.paymentGw.getSession(
        webhookBody.data.object.id,
      );
      const isPaymentSuccess = verifiedSession.paymentStatus === "paid";

      const updatedOrder = await orderModel.findByIdAndUpdate(
        {
          _id: verifiedSession.metadata.orderId,
        },
        {
          paymentStatus: isPaymentSuccess
            ? PaymentStatus.PAID
            : PaymentStatus.FAILED,
        },
        { new: true },
      );

      // todo: think about message broker message fail.
      const brokerMessage = {
        event_type: OrderEvents.PAYMENT_STATUS_UPDATE,
        data: updatedOrder,
      };

      await this.broker.sendMessage(
        "order",
        JSON.stringify(brokerMessage),
        updatedOrder._id.toString(),
      );
    }
    return res.json({ success: true });
  };
}

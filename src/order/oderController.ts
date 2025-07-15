import { Request, Response } from "express";

export class OrderController {
  create = (req: Request, res: Response) => {
      res.json({success: true})
  }
}


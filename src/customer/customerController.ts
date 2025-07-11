import { Response } from "express";
import { Request } from "express-jwt";
import customerModel from "./customerModel";

export class CustomerController {
  getCustomer = async (req:Request, res:Response) => {
    const {sub: userId, firstName, lastName, email} = req.auth;
    console.log('auth', req.auth);

    const customer = await customerModel.findOne({userId})

    if(!customer){
      const newCustomer = await customerModel.create({
        userId,
        firstName,
        lastName,
        email,
        addresses: [],
      })
      return res.json(newCustomer)
    }

    res.json(customer)
  }
}
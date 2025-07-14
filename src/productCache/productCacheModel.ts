import mongoose from "mongoose";
import { ProductPricingCache } from "../types";


const priceSchema = new mongoose.Schema({
  priceType: {
    type: String,
    enum: ["base", "additional"]
  },
  availableOption: {
    type: Object,
    of: Number
  }
})
const productCacheSchema = new mongoose.Schema<ProductPricingCache>({
   productId: {
    type: String,
    required: true
   },
   priceConfiguration: {
     type: Object,
     of: priceSchema,
   }
})

export default mongoose.model('ProdcutPricingCache', productCacheSchema, 'productCache')
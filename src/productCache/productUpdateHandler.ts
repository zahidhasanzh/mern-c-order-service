import { ProductMessage } from "../types"
import productCacheModel from "./productCacheModel"

export const handleProdcutUpdate = async (value: string) => {
  const product:ProductMessage = JSON.parse(value)

  return await productCacheModel.updateOne({
     productId: product.data.id
  }, {
    $set: {
       priceConfiguration: product.data.priceConfiguration
    }
  }, {upsert:true})
}
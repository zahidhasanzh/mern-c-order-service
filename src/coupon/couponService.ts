import { paginationLabels } from "../config/pagination";
import couponModel from "./couponModel";
import { Filter, Paginatequery } from "./couponTypes";

export class CouponService {
  async getCoupons(q: string, filters: Filter, paginateQuery: Paginatequery) {
    const searchQueryRegexp = new RegExp(q, "i");

    const matchQuery = {
      ...filters,
      title: searchQueryRegexp,
    };


    const aggregate = couponModel.aggregate([
      {
        $match: matchQuery,
      },
      {
        $sort: { _id: -1 },
      },
    ]);

    return couponModel.aggregatePaginate(aggregate, {
      ...paginateQuery,
      customLabels: paginationLabels,
    });
  }
}

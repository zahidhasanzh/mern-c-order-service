export interface Coupon {
  id: string;
  title: string;
  code: string;
  validUpto: Date;
  tenantId: string;
  discount: number;
  createdAt: Date;
  updatedAt: Date;
}


export interface Filter {
    tenantId?: string;
}
export interface Paginatequery {
    page: number;
    limit: number;
}
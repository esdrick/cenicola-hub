import type {
  User,
  Product,
  ProductVariant,
  InventoryMovement,
  Order,
  OrderItem,
  OrderPayment,
  OrderShipment,
  ExchangeRate,
  Expense,
  AccountReceivable,
  Payroll,
  AuditLog,
  UserRole,
  MovementType,
  MovementChannel,
  OrderChannel,
  OrderStatus,
  PaymentType,
  PaymentStatus,
  ReceivableStatus,
} from "@/app/generated/prisma/client";

export type {
  User,
  Product,
  ProductVariant,
  InventoryMovement,
  Order,
  OrderItem,
  OrderPayment,
  OrderShipment,
  ExchangeRate,
  Expense,
  AccountReceivable,
  Payroll,
  AuditLog,
  UserRole,
  MovementType,
  MovementChannel,
  OrderChannel,
  OrderStatus,
  PaymentType,
  PaymentStatus,
  ReceivableStatus,
};

// ─── Utility types ───────────────────────────────────────────────────────────

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ─── Session / Auth ──────────────────────────────────────────────────────────

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

// ─── JSON-safe serialized types (Decimal → number, Date → string) ────────────

export type ProductVariantJSON = {
  id: string;
  product_id: string;
  size: string;
  sku: string;
  stock_total: number;
  stock_online: number;
  stock_store: number;
  price_usd: number;
  is_active: boolean;
  updated_at: string;
};

export type ProductJSON = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  description: string | null;
  photos: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  variants: ProductVariantJSON[];
  creator: { id: string; name: string };
  hasLowStock?: boolean;
};

export type MovementJSON = {
  id: string;
  type: MovementType;
  channel: MovementChannel;
  qty_before: number;
  qty_change: number;
  qty_after: number;
  reason: string | null;
  order_id: string | null;
  created_at: string;
  variant: {
    id: string;
    size: string;
    sku: string;
    product: { id: string; name: string; color: string | null };
  };
  created_by_user: { id: string; name: string };
};

// ─── Form input types ────────────────────────────────────────────────────────

export type VariantInput = {
  id?: string;
  size: string;
  stock_online: number;
  stock_store: number;
  is_active: boolean;
  isNew?: boolean;
};

// ─── Product with variants (Prisma, for server-side use) ─────────────────────

export type ProductWithVariants = Product & {
  variants: ProductVariant[];
  creator: Pick<User, "id" | "name">;
};

// ─── Order JSON-safe types ───────────────────────────────────────────────────

export type OrderItemJSON = {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
  unit_price_usd: number;
  subtotal_usd: number;
  variant_snapshot: unknown;
  variant?: {
    id: string;
    size: string;
    sku: string;
    product: { id: string; name: string; color: string | null; photos: string[] };
  };
};

export type OrderPaymentJSON = {
  id: string;
  order_id: string;
  payment_type: PaymentType;
  amount_usd: number;
  is_partial: boolean;
  payment_date: string;
  payment_time: string | null;
  reference: string;
  reference_hash: string | null;
  payment_photo: string | null;
  status: PaymentStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
};

export type OrderJSON = {
  id: string;
  order_number: string;
  channel: OrderChannel;
  status: OrderStatus;
  customer_name: string;
  customer_lastname: string;
  customer_id_doc: string;
  address: string | null;
  shipping_company: string | null;
  total_usd: number;
  is_partial_agreed: boolean;
  partial_agreed_by: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator: { id: string; name: string };
  items?: OrderItemJSON[];
  payments?: OrderPaymentJSON[];
};

// ─── Order form types ─────────────────────────────────────────────────────────

export type CartItem = {
  variant_id: string;
  product_id: string;
  product_name: string;
  color: string | null;
  photo: string | null;
  size: string;
  sku: string;
  unit_price_usd: number;
  quantity: number;
  max_qty: number;
};

export type PaymentFormInput = {
  payment_type: PaymentType;
  amount_usd: string;
  payment_date: string;
  payment_time: string;
  reference: string;
  payment_photo: string;
  is_partial: boolean;
};

// ─── Order with all relations ────────────────────────────────────────────────

export type OrderWithDetails = Order & {
  items: (OrderItem & { variant: ProductVariant })[];
  payments: OrderPayment[];
  shipment: OrderShipment | null;
  creator: Pick<User, "id" | "name">;
};

// ─── Dashboard stats ─────────────────────────────────────────────────────────

export type DashboardStats = {
  total_sales_usd: number;
  orders_today: number;
  orders_pending: number;
  low_stock_variants: number;
};

// ─── Pagos (payment verification) ────────────────────────────────────────────

export type PagoPaymentJSON = OrderPaymentJSON & {
  amount_ves: number | null;
  exchange_rate_id: string | null;
  exchange_rate: { rate_date: string; usd_to_ves: number } | null;
  duplicate_order_number: string | null;
};

export type PagoOrdenJSON = {
  id: string;
  order_number: string;
  channel: OrderChannel;
  status: OrderStatus;
  customer_name: string;
  customer_lastname: string;
  total_usd: number;
  is_partial_agreed: boolean;
  paid_usd: number;
  payments: Array<{
    id: string;
    payment_type: PaymentType;
    amount_usd: number;
    reference: string;
    payment_date: string;
    status: PaymentStatus;
  }>;
  creator: { id: string; name: string };
  created_at: string;
};

export type PagoOrdenDetailJSON = Omit<OrderJSON, "payments"> & {
  items: OrderItemJSON[];
  payments: PagoPaymentJSON[];
};

// ─── Embalaje ────────────────────────────────────────────────────────────────
export type EmbalajeShipmentJSON = {
  id: string;
  packed_by: string;
  packed_at: string;
  shipped_at: string | null;
  tracking_number: string | null;
  photo_package: string;
  photo_receipt: string | null;
  notes: string | null;
  packer: { id: string; name: string };
};

export type EmbalajeOrdenJSON = {
  id: string;
  order_number: string;
  channel: OrderChannel;
  status: OrderStatus;
  customer_name: string;
  customer_lastname: string;
  address: string | null;
  shipping_company: string | null;
  total_usd: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  creator: { id: string; name: string };
  items_summary: string;
  shipment: EmbalajeShipmentJSON | null;
};

export type EmbalajeOrdenDetailJSON = {
  id: string;
  order_number: string;
  channel: OrderChannel;
  status: OrderStatus;
  customer_name: string;
  customer_lastname: string;
  customer_id_doc: string;
  address: string | null;
  shipping_company: string | null;
  total_usd: number;
  notes: string | null;
  created_at: string;
  creator: { id: string; name: string };
  items: OrderItemJSON[];
  shipment: EmbalajeShipmentJSON | null;
};

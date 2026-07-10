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

// DocumentType is not re-exported via the /client barrel due to generator version;
// defined here as the canonical project type.
export type DocumentType = "V" | "P" | "J" | "E";

export type CartStatus = "active" | "converting";

// ─── Customer ────────────────────────────────────────────────────────────────

export type CustomerJSON = {
  id: string;
  doc_type: "V" | "P" | "J" | "E";
  doc_number: string;
  name: string;
  lastname: string;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  _count?: { orders: number };
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
  price_bcv: number;
  price_divisas: number;
  price_bundle_bcv: number;
  price_bundle_divisas: number;
  price_mayor_bcv: number;
  price_mayor_divisas: number;
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
  quick_sale: boolean;
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
  pricing_method: "bcv" | "divisas" | null;
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

// ─── Inventory stock view ────────────────────────────────────────────────────

export type StockVariantJSON = {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  stock_total: number;
  stock_online: number;
  stock_store: number;
  price_bcv: number;
  product: {
    id: string;
    name: string;
    type: string;
    color: string | null;
  };
};

// ─── User JSON-safe type ──────────────────────────────────────────────────────

export type UserJSON = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  creator?: { id: string; name: string } | null;
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
  photo_guide: string | null;
  notes: string | null;
  edited_at: string | null;
  packer: { id: string; name: string };
  editor: { id: string; name: string } | null;
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

// ─── Cart JSON-safe types ─────────────────────────────────────────────────────

export type CartItemJSON = {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  unit_price_usd: number;
  created_at: string;
  stock_warning: boolean;
  stock_available: number;
  variant: {
    id: string;
    size: string;
    sku: string;
    stock_online: number;
    stock_store: number;
    product: {
      id: string;
      name: string;
      color: string | null;
      photos: string[];
    };
  };
};

export type CartJSON = {
  id: string;
  vendor_id: string;
  channel: OrderChannel;
  note: string | null;
  status: CartStatus;
  pricing_method: "bcv" | "divisas";
  created_at: string;
  updated_at: string;
  vendor: { id: string; name: string };
  items: CartItemJSON[];
  total_usd: number;
  has_stock_issues: boolean;
  mayor_threshold?: number;
  bundle_threshold?: number;
};

export type EmbalajeOrdenDetailJSON = {
  id: string;
  order_number: string;
  channel: OrderChannel;
  status: OrderStatus;
  customer_name: string;
  customer_lastname: string;
  customer_id_doc: string;
  customer_phone: string | null;
  address: string | null;
  shipping_company: string | null;
  total_usd: number;
  notes: string | null;
  created_at: string;
  creator: { id: string; name: string };
  items: OrderItemJSON[];
  shipment: EmbalajeShipmentJSON | null;
};

import { z } from "zod";
import { isValidMobile, normalizeMobile } from "@/utils/phone";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z
      .string()
      .min(10, "Enter 10-digit mobile number")
      .refine((v) => isValidMobile(v), "Enter a valid 10-digit Indian mobile"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const addressSchema = z.object({
  address_line: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postal_code: z.string().min(5, "Valid postal code required"),
  is_default: z.boolean().optional(),
});

export const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || /^[0-9]{10}$/.test(v), "Enter 10-digit mobile number"),
});

/** Product admin form — explicit type for react-hook-form + zodResolver */
export type ProductInput = {
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  image_url: string;
  category_id?: string;
  featured: boolean;
  is_bestseller?: boolean;
  is_new_arrival?: boolean;
  sku?: string | null;
  barcode?: string;
  brand?: string;
  unit?: string;
  pieces_per_packet?: number;
  packets_per_box?: number;
  packet_selling_price?: number;
  box_selling_price?: number;
  purchase_price?: number;
  mrp?: number;
  gst_percentage?: number;
  reorder_level?: number;
  min_stock_level?: number;
  auto_refill_enabled?: boolean;
  auto_refill_quantity?: number;
  auto_refill_time?: string;
  auto_refill_slot2_enabled?: boolean;
  auto_refill_slot2_quantity?: number;
  auto_refill_slot2_time?: string;
};

export const productSchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z
    .string()
    .min(2, "Slug is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens only"
    ),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  stock: z.coerce.number().int().min(0, "Stock must be 0 or more"),
  image_url: z
    .string()
    .refine(
      (val) => {
        const s = val.trim();
        return (
          s === "" ||
          s.startsWith("/") ||
          s.startsWith("http://") ||
          s.startsWith("https://")
        );
      },
      { message: "Enter a valid URL or upload an image" }
    ),
  category_id: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().uuid().safeParse(val).success,
      { message: "Select a valid category" }
    ),
  featured: z.boolean().default(false),
  is_bestseller: z.boolean().default(false),
  is_new_arrival: z.boolean().default(false),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  unit: z.string().optional(),
  pieces_per_packet: z.coerce.number().int().min(1).optional(),
  packets_per_box: z.coerce.number().int().min(1).optional(),
  packet_selling_price: z.coerce.number().min(0).optional(),
  box_selling_price: z.coerce.number().min(0).optional(),
  purchase_price: z.coerce.number().min(0).optional(),
  mrp: z.coerce.number().min(0).optional(),
  gst_percentage: z.coerce.number().min(0).max(100).optional(),
  reorder_level: z.coerce.number().int().min(0).optional(),
  min_stock_level: z.coerce.number().int().min(0).optional(),
  auto_refill_enabled: z.boolean().optional().default(false),
  auto_refill_quantity: z.coerce.number().int().min(0).optional(),
  auto_refill_time: z.string().optional(),
  auto_refill_slot2_enabled: z.boolean().optional().default(false),
  auto_refill_slot2_quantity: z.coerce.number().int().min(0).optional(),
  auto_refill_slot2_time: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z.string().min(2, "Slug is required"),
  image: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;

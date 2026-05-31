import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
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

const emptyToNull = (val: unknown) =>
  val === "" || val === undefined || val === null ? null : val;

export const productSchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z
    .string()
    .min(2, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  price: z.preprocess(
    (val) => {
      const n = Number(val);
      return Number.isFinite(n) ? n : 0;
    },
    z.number().min(0, "Price must be 0 or more")
  ),
  stock: z.preprocess(
    (val) => {
      const n = Number(val);
      return Number.isFinite(n) ? Math.floor(n) : 0;
    },
    z.number().int().min(0, "Stock must be 0 or more")
  ),
  image_url: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : ""),
    z
      .string()
      .refine(
        (val) =>
          val === "" ||
          val.startsWith("/") ||
          val.startsWith("http://") ||
          val.startsWith("https://"),
        { message: "Enter a valid URL or upload an image" }
      )
  ),
  category_id: z.preprocess(
    emptyToNull,
    z.union([z.string().uuid("Select a valid category"), z.null()]).optional()
  ),
  featured: z.boolean().optional().default(false),
});

export const categorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z.string().min(2, "Slug is required"),
  image: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;

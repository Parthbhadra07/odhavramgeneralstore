"use client";

import { useEffect, useState, useRef } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Upload } from "lucide-react";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import { uploadProductImage } from "@/services/storage.service";
import { productSchema, type ProductInput } from "@/lib/validators";
import { formatPrice } from "@/utils/format";
import { slugify } from "@/utils/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductBarcodeField } from "@/components/admin/product-barcode-field";
import { AdminFab } from "@/components/admin/admin-fab";
import type { Product, Category } from "@/types/database";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } =
    useForm<ProductInput>({
      resolver: zodResolver(productSchema) as Resolver<ProductInput>,
      defaultValues: {
        name: "",
        slug: "",
        price: 0,
        stock: 0,
        image_url: "",
        description: "",
        category_id: "",
        featured: false,
      },
    });

  const imageUrl = watch("image_url");

  const load = () => {
    productService.getAll().then(setProducts);
    categoryService.getAll().then(setCategories);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    reset({
      name: "",
      slug: "",
      price: 0,
      stock: 0,
      featured: false,
      image_url: "",
      category_id: "",
      description: "",
      barcode: "",
      sku: "",
    });
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    reset({
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      price: product.selling_price ?? product.price,
      stock: product.stock,
      image_url: product.image_url ?? "",
      category_id: product.category_id ?? "",
      featured: product.featured,
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      brand: product.brand ?? "",
      unit: product.unit ?? "pcs",
      purchase_price: product.purchase_price ?? undefined,
      mrp: product.mrp ?? undefined,
      gst_percentage: product.gst_percentage ?? 0,
      reorder_level: product.reorder_level ?? 10,
      min_stock_level: product.min_stock_level ?? 5,
    });
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setValue("image_url", url, { shouldValidate: true });
      toast.success("Image uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: ProductInput) => {
    try {
      const payload = {
        name: data.name.trim(),
        slug: slugify(data.slug || data.name),
        description: data.description ?? "",
        price: data.price,
        stock: data.stock,
        image_url: data.image_url?.trim() || null,
        category_id: data.category_id?.trim() ? data.category_id : null,
        featured: Boolean(data.featured),
        is_bestseller: Boolean(data.is_bestseller),
        is_new_arrival: Boolean(data.is_new_arrival),
        sku: data.sku?.trim() || null,
        barcode: data.barcode?.trim() || null,
        brand: data.brand?.trim() || null,
        unit: data.unit?.trim() || "pcs",
        purchase_price: data.purchase_price,
        mrp: data.mrp,
        gst_percentage: data.gst_percentage ?? 0,
        reorder_level: data.reorder_level ?? 10,
        min_stock_level: data.min_stock_level ?? 5,
        selling_price: data.price,
      };

      if (editing) {
        await productService.update(editing.id, payload);
        toast.success("Product updated");
      } else {
        await productService.create(payload);
        toast.success("Product created");
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save product";
      toast.error(msg);
      console.error("Product save error:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await productService.remove(id);
    toast.success("Product deleted");
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="admin-page-title">Products</h1>
        <Button onClick={openCreate} className="hidden lg:inline-flex">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <AdminFab label="Add Product" icon={Plus} onClick={openCreate} />

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mb-6 grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2"
        >
          <Input label="Name" error={errors.name?.message} {...register("name", {
            onChange: (e) => !editing && setValue("slug", slugify(e.target.value)),
          })} />
          <Input label="Slug" error={errors.slug?.message} {...register("slug")} />
          <Input label="Selling Price" type="number" step="0.01" error={errors.price?.message} {...register("price")} />
          <Input label="Stock" type="number" step="1" error={errors.stock?.message} {...register("stock")} />
          <Input label="SKU" {...register("sku")} />
          <div className="sm:col-span-2">
            <Controller
              name="barcode"
              control={control}
              render={({ field }) => (
                <ProductBarcodeField
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.barcode?.message}
                />
              )}
            />
          </div>
          <Input label="Brand" {...register("brand")} />
          <Input label="Unit" placeholder="pcs, kg, L" {...register("unit")} />
          <Input label="Purchase Price" type="number" step="0.01" {...register("purchase_price")} />
          <Input label="MRP" type="number" step="0.01" {...register("mrp")} />
          <Input label="GST %" type="number" step="0.01" {...register("gst_percentage")} />
          <Input label="Reorder Level" type="number" {...register("reorder_level")} />
          <Input label="Min Stock" type="number" {...register("min_stock_level")} />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Product Image</label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                variant="outline"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Upload Image
              </Button>
              <span className="text-xs text-gray-500">or paste URL below</span>
            </div>
            <Input
              label="Image URL"
              error={errors.image_url?.message}
              placeholder="https://... or upload above"
              {...register("image_url")}
            />
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Preview"
                className="mt-2 h-24 w-24 rounded-lg border object-cover"
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              {...register("category_id")}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <textarea
            {...register("description")}
            placeholder="Description"
            className="col-span-full rounded-lg border px-3 py-2 text-sm"
            rows={3}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("featured")} /> Featured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_bestseller")} /> Bestseller
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_new_arrival")} /> New Arrival
          </label>
          {Object.keys(errors).length > 0 && (
            <p className="col-span-full text-sm text-red-600">
              Please fix the highlighted fields above.
            </p>
          )}
          <div className="col-span-full flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="-mx-4 overflow-x-auto rounded-xl border bg-white shadow-sm sm:mx-0">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Featured</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.sku ?? "—"}</td>
                <td className="px-4 py-3">{formatPrice(p.price)}</td>
                <td className="px-4 py-3">{p.stock}</td>
                <td className="px-4 py-3">{p.featured ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => openEdit(p)} className="mr-2 text-blue-600">
                    <Pencil className="h-4 w-4 inline" />
                  </button>
                  <button type="button" onClick={() => handleDelete(p.id)} className="text-red-600">
                    <Trash2 className="h-4 w-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

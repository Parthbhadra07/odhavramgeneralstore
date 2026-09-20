"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  Plus,
  Upload,
  Boxes,
  Archive,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Package,
} from "lucide-react";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import { uploadProductImage } from "@/services/storage.service";
import { productSchema, type ProductInput } from "@/lib/validators";
import { formatPrice } from "@/utils/format";
import { slugify } from "@/utils/format";
import { cn } from "@/utils/cn";
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

  const [filterTab, setFilterTab] = useState<"active" | "archived" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingProduct, setDeletingProduct] = useState<{
    id: string;
    name: string;
    isArchived: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
  const watchPrice = Number(watch("price") || 0);
  const watchPcsPerPkt = Number(watch("pieces_per_packet") || 12);
  const watchPktsPerBox = Number(watch("packets_per_box") || 12);
  const watchTotalPcsInBox = (watchPcsPerPkt || 12) * (watchPktsPerBox || 12);

  const load = () => {
    productService.getAll({ includeInactive: true }).then(setProducts);
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
      unit: "pcs",
      pieces_per_packet: 12,
      packets_per_box: 12,
      packet_selling_price: undefined,
      box_selling_price: undefined,
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
      barcode: product.barcode ?? "",
      brand: product.brand ?? "",
      unit: product.unit ?? "pcs",
      pieces_per_packet: product.pieces_per_packet ?? 12,
      packets_per_box: product.packets_per_box ?? 12,
      packet_selling_price: product.packet_selling_price ?? undefined,
      box_selling_price: product.box_selling_price ?? undefined,
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
        sku: null,
        barcode: data.barcode?.trim() || null,
        brand: data.brand?.trim() || null,
        unit: data.unit?.trim() || "pcs",
        pieces_per_packet: data.pieces_per_packet ? Number(data.pieces_per_packet) : 12,
        packets_per_box: data.packets_per_box ? Number(data.packets_per_box) : 12,
        packet_selling_price: data.packet_selling_price !== undefined && data.packet_selling_price !== null && String(data.packet_selling_price) !== "" ? Number(data.packet_selling_price) : null,
        box_selling_price: data.box_selling_price !== undefined && data.box_selling_price !== null && String(data.box_selling_price) !== "" ? Number(data.box_selling_price) : null,
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

  const activeProducts = useMemo(
    () => products.filter((p) => p.is_active !== false),
    [products]
  );
  const archivedProducts = useMemo(
    () => products.filter((p) => p.is_active === false),
    [products]
  );

  const displayedProducts = useMemo(() => {
    let list =
      filterTab === "active"
        ? activeProducts
        : filterTab === "archived"
        ? archivedProducts
        : products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }
    return list;
  }, [filterTab, activeProducts, archivedProducts, products, searchQuery]);

  const handleRestore = async (id: string, name?: string) => {
    try {
      await productService.restore(id);
      toast.success(`Product "${name || "Item"}" restored to active catalog!`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to restore product");
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      const res = await productService.remove(deletingProduct.id, {
        force: deletingProduct.isArchived,
      });
      if (res?.action === "deactivated") {
        toast.info(res.message || "Product has sales history and was moved to Archived Products.");
      } else {
        toast.success(res?.message || "Product deleted successfully");
      }
      setDeletingProduct(null);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete product";
      toast.error(msg);
      console.error("Product delete error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const confirmBulkDeleteArchived = async () => {
    if (archivedProducts.length === 0) return;
    setBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;
    for (const p of archivedProducts) {
      try {
        await productService.remove(p.id, { force: true });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBulkDeleting(false);
    setShowBulkDeleteModal(false);
    if (successCount > 0) {
      toast.success(`Permanently deleted ${successCount} archived product(s).`);
    }
    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} archived product(s).`);
    }
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
              const target = e.target as HTMLInputElement;
              if (target.type !== "submit") {
                e.preventDefault();
              }
            }
          }}
          className="mb-6 grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2"
        >
          <Input label="Name" error={errors.name?.message} {...register("name", {
            onChange: (e) => !editing && setValue("slug", slugify(e.target.value)),
          })} />
          <Input label="Slug" error={errors.slug?.message} {...register("slug")} />
          <Input label="Selling Price" type="number" step="0.01" error={errors.price?.message} {...register("price")} />
          <Input label="Stock" type="number" step="1" error={errors.stock?.message} {...register("stock")} />
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

          {/* Packaging Hierarchy: Pcs, Packets, Boxes */}
          <div className="sm:col-span-2 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-indigo-50/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                  <Boxes className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Packaging Hierarchy (Pcs, Packets, Boxes)
                  </h3>
                  <p className="text-xs text-gray-600">
                    Define multi-unit packaging so POS and billing can sell in Pcs, Packets, and Boxes with instant shortcuts.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-blue-200/80 bg-white p-3 text-xs sm:grid-cols-3 shadow-xs">
              <div className="rounded-md bg-blue-50/70 p-2.5 border border-blue-100">
                <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wider">1. Single Piece</span>
                <p className="mt-0.5 text-gray-800 font-semibold">1 Pc = 1 pc</p>
                <p className="text-[11px] text-gray-600 font-medium mt-0.5">Price: {formatPrice(watchPrice)}</p>
              </div>
              <div className="rounded-md bg-indigo-50/70 p-2.5 border border-indigo-100">
                <span className="font-bold text-indigo-900 block text-[11px] uppercase tracking-wider">2. Packet (Pkt)</span>
                <p className="mt-0.5 text-gray-800 font-semibold">1 Pkt = {watchPcsPerPkt || 12} pcs</p>
                <p className="text-[11px] text-gray-600 font-medium mt-0.5">
                  Est. Rate: {formatPrice(watchPrice * (watchPcsPerPkt || 12))}
                </p>
              </div>
              <div className="rounded-md bg-purple-50/70 p-2.5 border border-purple-100">
                <span className="font-bold text-purple-900 block text-[11px] uppercase tracking-wider">3. Master Box</span>
                <p className="mt-0.5 text-gray-800 font-semibold">
                  1 Box = {watchPktsPerBox || 12} pkts ({watchTotalPcsInBox || 144} pcs)
                </p>
                <p className="text-[11px] text-gray-600 font-medium mt-0.5">
                  Est. Rate: {formatPrice(watchPrice * (watchTotalPcsInBox || 144))}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Pieces per Packet (1 pkt = X pcs)"
                type="number"
                min={1}
                step="1"
                placeholder="12"
                error={errors.pieces_per_packet?.message}
                {...register("pieces_per_packet")}
              />
              <Input
                label="Packets per Box (1 box = Y pkts)"
                type="number"
                min={1}
                step="1"
                placeholder="12"
                error={errors.packets_per_box?.message}
                {...register("packets_per_box")}
              />
              <Input
                label="Custom Packet Selling Price (₹) (Optional)"
                type="number"
                step="0.01"
                min={0}
                placeholder={`Default: ₹${(watchPrice * (watchPcsPerPkt || 12)).toFixed(2)}`}
                error={errors.packet_selling_price?.message}
                {...register("packet_selling_price")}
              />
              <Input
                label="Custom Box Selling Price (₹) (Optional)"
                type="number"
                step="0.01"
                min={0}
                placeholder={`Default: ₹${(watchPrice * (watchTotalPcsInBox || 144)).toFixed(2)}`}
                error={errors.box_selling_price?.message}
                {...register("box_selling_price")}
              />
              <div className="sm:col-span-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
                <span className="font-bold text-emerald-900 block mb-0.5">💡 Single Barcode System</span>
                No different barcode needed for packets or boxes — uses the same product barcode. In POS, packets and boxes will be automatically calculated as per the quantity entered or scanned!
              </div>
            </div>
          </div>

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

      {/* Filter Tabs & Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterTab("active")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              filterTab === "active"
                ? "bg-gray-900 text-white shadow-xs"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Active Products
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.2 text-xs",
                filterTab === "active" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
              )}
            >
              {activeProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("archived")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              filterTab === "archived"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
            )}
          >
            <Archive className="h-4 w-4" />
            Archived Products
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.2 text-xs font-bold",
                filterTab === "archived" ? "bg-white/25 text-white" : "bg-amber-200 text-amber-900"
              )}
            >
              {archivedProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              filterTab === "all"
                ? "bg-gray-800 text-white shadow-xs"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            All Products
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.2 text-xs",
                filterTab === "all" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
              )}
            >
              {products.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search name, barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Archived Products Information Banner */}
      {filterTab === "archived" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Archive className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-950">Archived Products Directory</h4>
                <p className="mt-0.5 text-xs text-amber-800">
                  Products with previous sales or purchase history are archived here to protect past bills.
                  You can <strong>Restore</strong> them to the active catalog or <strong>Delete Permanently</strong>.
                </p>
              </div>
            </div>
            {archivedProducts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkDeleteModal(true)}
                className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 text-xs shrink-0 self-start sm:self-auto"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete All Archived ({archivedProducts.length})
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto rounded-xl border bg-white shadow-sm sm:mx-0">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Featured</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  {filterTab === "archived" ? (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Archive className="h-8 w-8 text-gray-300" />
                      <p className="font-medium text-gray-700">No archived products</p>
                      <p className="text-xs text-gray-400">All products in your store are currently active.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="h-8 w-8 text-gray-300" />
                      <p className="font-medium text-gray-700">No products found</p>
                      <p className="text-xs text-gray-400">Try adjusting your search query or filter tab.</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              displayedProducts.map((p) => {
                const isArchived = p.is_active === false;
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b transition hover:bg-gray-50/70",
                      isArchived && "bg-amber-50/30"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn(isArchived && "text-gray-600 font-medium")}>{p.name}</span>
                        {isArchived && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300 shrink-0">
                            <Archive className="h-3 w-3" /> Archived
                          </span>
                        )}
                      </div>
                      {p.barcode && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">Barcode: {p.barcode}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(p.stock <= 5 ? "text-red-600 font-bold" : "text-gray-700")}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.featured ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isArchived ? (
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(p.id, p.name)}
                            className="h-8 px-2.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                            title="Restore to active catalog"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDeletingProduct({ id: p.id, name: p.name, isArchived: true })
                            }
                            className="h-8 px-2.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border-red-200"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Permanently
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                            title="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeletingProduct({ id: p.id, name: p.name, isArchived: false })
                            }
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Single Product Delete Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                  deletingProduct.isArchived
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-600"
                )}
              >
                {deletingProduct.isArchived ? (
                  <Trash2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {deletingProduct.isArchived
                    ? "Delete Archived Product Permanently?"
                    : "Delete Product?"}
                </h3>
                <p className="text-xs text-gray-500 font-medium truncate max-w-[280px]">
                  {deletingProduct.name}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              {deletingProduct.isArchived ? (
                <>
                  Are you sure you want to permanently delete{" "}
                  <strong>&ldquo;{deletingProduct.name}&rdquo;</strong>? This will remove this archived product and clean up all associated records permanently. This action <strong>cannot be undone</strong>.
                </>
              ) : (
                <>
                  Are you sure you want to delete{" "}
                  <strong>&ldquo;{deletingProduct.name}&rdquo;</strong>? If this product has past sales bills or invoice history, it will be safely moved to <strong>Archived Products</strong> to preserve your records.
                </>
              )}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setDeletingProduct(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deleting}
                onClick={confirmDeleteProduct}
                className={cn(
                  "text-white",
                  deletingProduct.isArchived
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {deletingProduct.isArchived ? "Delete Permanently" : "Delete Product"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Archived Products Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete All Archived Products?</h3>
                <p className="text-xs text-red-600 font-medium">
                  {archivedProducts.length} product(s) will be permanently purged
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              Are you sure you want to permanently delete all{" "}
              <strong>{archivedProducts.length} archived product(s)</strong>? This will permanently delete them from your database. This action <strong>cannot be undone</strong>.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={bulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={bulkDeleting}
                onClick={confirmBulkDeleteArchived}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete All Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

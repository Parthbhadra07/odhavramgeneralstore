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
  RefreshCw,
  Clock,
  Sparkles,
  FileSpreadsheet,
  ScanBarcode,
  Download,
  Scale,
  Printer,
  Tag,
  FolderTree,
  X,
  Percent,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  Table as TableIcon,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { productService } from "@/services/product.service";
import { autoRefillService } from "@/services/auto-refill.service";
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
import { BulkProductImportModal } from "@/components/admin/bulk-product-import-modal";
import { MultiProductSpreadsheet } from "@/components/admin/multi-product-spreadsheet";
import { StockVerificationModal } from "@/components/admin/stock-verification-modal";
import { exportProductsToCSV, downloadCSVFile } from "@/utils/csv-helper";
import { getOfferTimeRemaining, isOfferActive, getProductOfferDates } from "@/utils/offer-helper";
import { dealBannerService, type DealBannerConfig, type DealBannerItem } from "@/services/deal-banner.service";
import type { Product, Category } from "@/types/database";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [filterTab, setFilterTab] = useState<"active" | "offers" | "archived" | "autorefill" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Offer Modal State
  const [offerModalProduct, setOfferModalProduct] = useState<Product | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerMrp, setOfferMrp] = useState<number>(0);
  const [offerPrice, setOfferPrice] = useState<number>(0);
  const [offerFeatured, setOfferFeatured] = useState<boolean>(true);
  const [offerStartDate, setOfferStartDate] = useState<string>("");
  const [offerEndDate, setOfferEndDate] = useState<string>("");
  const [selectedOfferProductManualId, setSelectedOfferProductManualId] = useState<string>("");
  const [savingOffer, setSavingOffer] = useState(false);

  // Home Page Deal Banner Config Modal State
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [bannerConfig, setBannerConfig] = useState<DealBannerConfig>(dealBannerService.getDefaults());
  const [activeBannerIndex, setActiveBannerIndex] = useState<number>(0);
  const [bannerViewMode, setBannerViewMode] = useState<"table" | "edit">("table");
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  const [runningRefill, setRunningRefill] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<{
    id: string;
    name: string;
    isArchived: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSpreadsheet, setShowSpreadsheet] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

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
        is_loose: false,
      },
    });

  const imageUrl = watch("image_url");
  const watchPrice = Number(watch("price") || 0);
  const watchPcsPerPkt = Number(watch("pieces_per_packet") || 12);
  const watchPktsPerBox = Number(watch("packets_per_box") || 12);
  const watchTotalPcsInBox = (watchPcsPerPkt || 12) * (watchPktsPerBox || 12);

  const watchAutoRefillEnabled = Boolean(watch("auto_refill_enabled"));
  const watchAutoRefillQty = Number(watch("auto_refill_quantity") || 0);
  const watchAutoRefillTime = watch("auto_refill_time") || "06:00";
  const watchSlot2Enabled = Boolean(watch("auto_refill_slot2_enabled"));
  const watchSlot2Qty = Number(watch("auto_refill_slot2_quantity") || 0);
  const watchSlot2Time = watch("auto_refill_slot2_time") || "16:00";

  const load = () => {
    productService.getAll({ includeInactive: true }).then(setProducts);
    categoryService.getAll().then(setCategories);
  };

  useEffect(() => { load(); }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "offers") {
      setFilterTab("offers");
    } else if (tab === "banners") {
      dealBannerService.get().then((cfg) => {
        setBannerConfig(cfg);
        setActiveBannerIndex(0);
      });
      setShowBannerModal(true);
    }
  }, [searchParams]);

  const openCreate = (defaultCategoryId?: string | React.MouseEvent) => {
    const catId = typeof defaultCategoryId === "string" ? defaultCategoryId : "";
    setEditing(null);
    reset({
      name: "",
      slug: "",
      price: 0,
      stock: 0,
      featured: false,
      image_url: "",
      category_id: catId,
      description: "",
      barcode: "",
      unit: "pcs",
      pieces_per_packet: 12,
      packets_per_box: 12,
      packet_selling_price: undefined,
      box_selling_price: undefined,
      auto_refill_enabled: false,
      auto_refill_quantity: 50,
      auto_refill_time: "06:00",
      auto_refill_slot2_enabled: false,
      auto_refill_slot2_quantity: 30,
      auto_refill_slot2_time: "16:00",
      is_loose: false,
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
      auto_refill_enabled: product.auto_refill_enabled ?? false,
      auto_refill_quantity: product.auto_refill_quantity ?? 50,
      auto_refill_time: product.auto_refill_time ?? "06:00",
      auto_refill_slot2_enabled: product.auto_refill_slot2_enabled ?? false,
      auto_refill_slot2_quantity: product.auto_refill_slot2_quantity ?? 30,
      auto_refill_slot2_time: product.auto_refill_slot2_time ?? "16:00",
      is_loose: product.is_loose ?? false,
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
        is_loose: Boolean(data.is_loose),
        auto_refill_enabled: Boolean(data.auto_refill_enabled),
        auto_refill_quantity: data.auto_refill_quantity ? Number(data.auto_refill_quantity) : 0,
        auto_refill_time: data.auto_refill_time?.trim() || "06:00",
        auto_refill_slot2_enabled: Boolean(data.auto_refill_slot2_enabled),
        auto_refill_slot2_quantity: data.auto_refill_slot2_quantity ? Number(data.auto_refill_slot2_quantity) : 0,
        auto_refill_slot2_time: data.auto_refill_slot2_time?.trim() || "16:00",
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
  const offerProducts = useMemo(
    () => products.filter((p) => p.is_active !== false && (p.featured || (p.mrp && p.mrp > p.price))),
    [products]
  );
  const archivedProducts = useMemo(
    () => products.filter((p) => p.is_active === false),
    [products]
  );
  const autoRefillProducts = useMemo(
    () => products.filter((p) => p.is_active !== false && (p.auto_refill_enabled || p.auto_refill_slot2_enabled)),
    [products]
  );

  const displayedProducts = useMemo(() => {
    let list =
      filterTab === "active"
        ? activeProducts
        : filterTab === "offers"
        ? offerProducts
        : filterTab === "archived"
        ? archivedProducts
        : filterTab === "autorefill"
        ? autoRefillProducts
        : products;

    if (selectedCategoryFilter !== "all") {
      list = list.filter(
        (p) =>
          p.category_id === selectedCategoryFilter ||
          p.categories?.id === selectedCategoryFilter ||
          p.categories?.slug === selectedCategoryFilter
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.categories?.name && p.categories.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [filterTab, activeProducts, offerProducts, archivedProducts, autoRefillProducts, products, selectedCategoryFilter, searchQuery]);

  const groupedProductsByCategory = useMemo(() => {
    const map = new Map<string, { category: Category | null; products: Product[] }>();

    categories.forEach((cat) => {
      map.set(cat.id, { category: cat, products: [] });
    });

    const uncategorized: Product[] = [];

    displayedProducts.forEach((p) => {
      const catId = p.category_id || p.categories?.id;
      if (catId && map.has(catId)) {
        map.get(catId)!.products.push(p);
      } else {
        uncategorized.push(p);
      }
    });

    const groups: { key: string; name: string; category: Category | null; products: Product[] }[] = [];

    map.forEach((val, catId) => {
      if (val.products.length > 0) {
        groups.push({
          key: catId,
          name: val.category?.name || "Category",
          category: val.category,
          products: val.products,
        });
      }
    });

    if (uncategorized.length > 0) {
      groups.push({
        key: "uncategorized",
        name: "Uncategorized Items",
        category: null,
        products: uncategorized,
      });
    }

    return groups;
  }, [displayedProducts, categories]);

  const openOfferModal = (product: Product) => {
    setOfferModalProduct(product);
    setSelectedOfferProductManualId(product.id);
    const mrpVal = Number(product.mrp || product.price);
    setOfferMrp(mrpVal);
    setOfferPrice(Number(product.price));
    setOfferFeatured(Boolean(product.featured));

    const { startDate, endDate } = getProductOfferDates(product);
    const toLocalISO = (dStr?: string | null) => {
      if (!dStr) return "";
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const nowLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    setOfferStartDate(toLocalISO(startDate || product.offer_start_date) || nowLocal);
    setOfferEndDate(toLocalISO(endDate || product.offer_end_date));
    setShowOfferModal(true);
  };

  const openOfferModalForNew = () => {
    setOfferModalProduct(null);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setOfferStartDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    setOfferEndDate(`${in3Days.getFullYear()}-${pad(in3Days.getMonth() + 1)}-${pad(in3Days.getDate())}T${pad(in3Days.getHours())}:${pad(in3Days.getMinutes())}`);

    const firstP = activeProducts[0];
    if (firstP) {
      setSelectedOfferProductManualId(firstP.id);
      const mrpVal = Number(firstP.mrp || firstP.price);
      setOfferMrp(mrpVal);
      setOfferPrice(Number(firstP.price));
      setOfferFeatured(true);
    }
    setShowOfferModal(true);
  };

  const applyDiscountPreset = (percent: number) => {
    if (offerMrp > 0) {
      const discounted = Math.round(offerMrp * (1 - percent / 100));
      setOfferPrice(discounted);
    }
  };

  const applyValidityPreset = (duration: "24h" | "3d" | "7d" | "eom" | "none") => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setOfferStartDate(toLocal(now));

    if (duration === "none") {
      setOfferEndDate("");
      return;
    }

    const end = new Date(now);
    if (duration === "24h") {
      end.setHours(end.getHours() + 24);
    } else if (duration === "3d") {
      end.setDate(end.getDate() + 3);
    } else if (duration === "7d") {
      end.setDate(end.getDate() + 7);
    } else if (duration === "eom") {
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 0);
    }
    setOfferEndDate(toLocal(end));
  };

  const handleSaveOffer = async () => {
    const targetProduct = offerModalProduct || products.find((p) => p.id === selectedOfferProductManualId);
    if (!targetProduct) {
      toast.error("Please select a product");
      return;
    }
    if (offerPrice <= 0) {
      toast.error("Offer price must be greater than 0");
      return;
    }
    if (offerMrp > 0 && offerPrice > offerMrp) {
      toast.error("Offer price cannot be greater than MRP");
      return;
    }

    setSavingOffer(true);
    try {
      await productService.update(targetProduct.id, {
        price: offerPrice,
        selling_price: offerPrice,
        mrp: offerMrp > 0 ? offerMrp : null,
        featured: offerFeatured,
        offer_start_date: offerStartDate ? new Date(offerStartDate).toISOString() : null,
        offer_end_date: offerEndDate ? new Date(offerEndDate).toISOString() : null,
      });
      toast.success(`Offer updated for "${targetProduct.name}"!`);
      setShowOfferModal(false);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update offer");
    } finally {
      setSavingOffer(false);
    }
  };

  const handleRemoveOffer = async () => {
    const targetProduct = offerModalProduct || products.find((p) => p.id === selectedOfferProductManualId);
    if (!targetProduct) return;

    // When offer is removed, revert price and selling_price back to original MRP
    const originalPrice =
      targetProduct.mrp && Number(targetProduct.mrp) > 0
        ? Number(targetProduct.mrp)
        : Number(targetProduct.price);

    setSavingOffer(true);
    try {
      await productService.update(targetProduct.id, {
        price: originalPrice,
        selling_price: originalPrice,
        mrp: null,
        featured: false,
        offer_start_date: null,
        offer_end_date: null,
      });
      toast.success(
        `Offer removed from "${targetProduct.name}". Price reverted to ${formatPrice(originalPrice)}.`
      );
      setShowOfferModal(false);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove offer");
    } finally {
      setSavingOffer(false);
    }
  };

  const handleAddBanner = (type: "deal" | "photo") => {
    const newBanner = dealBannerService.createBanner(type);
    const updated = [...(bannerConfig.banners || []), newBanner];
    setBannerConfig({ ...bannerConfig, banners: updated });
    setActiveBannerIndex(updated.length - 1);
    setBannerViewMode("edit");
    toast.success(`Added new ${type === "photo" ? "Photo Advertising" : "Deals"} banner!`);
  };

  const handleRenewBanner = async (index: number, duration: "today" | "3d" | "7d" = "today") => {
    const list = [...(bannerConfig.banners || [])];
    if (!list[index]) return;

    let newEndDate = "realtime_daily";
    let timerMode: "realtime_daily" | "custom" = "realtime_daily";
    let message = "Banner renewed for today! Active until 23:59:59 tonight.";

    if (duration === "3d") {
      newEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      timerMode = "custom";
      message = "Banner renewed and extended by 3 days!";
    } else if (duration === "7d") {
      newEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      timerMode = "custom";
      message = "Banner renewed and extended by 7 days!";
    }

    list[index] = {
      ...list[index],
      enabled: true,
      endDate: newEndDate,
      timerMode,
    };

    const updatedConfig: DealBannerConfig = {
      ...bannerConfig,
      enabled: true,
      banners: list,
    };

    setBannerConfig(updatedConfig);
    try {
      await dealBannerService.save(updatedConfig);
      toast.success(message);
    } catch {
      toast.error("Failed to save renewed banner.");
    }
  };

  const handleToggleBannerEnabled = async (index: number) => {
    const list = [...(bannerConfig.banners || [])];
    if (!list[index]) return;
    const newState = !list[index].enabled;
    list[index] = { ...list[index], enabled: newState };
    const updatedConfig = { ...bannerConfig, banners: list };
    setBannerConfig(updatedConfig);
    try {
      await dealBannerService.save(updatedConfig);
      toast.success(newState ? "Banner enabled on home page" : "Banner hidden from home page");
    } catch {
      toast.error("Failed to update banner status");
    }
  };

  const handleDeleteBanner = async (indexToDelete: number) => {
    const list = bannerConfig.banners || [];
    let updatedBanners: DealBannerItem[] = [];
    let updatedEnabled = bannerConfig.enabled;
    if (list.length <= 1) {
      updatedBanners = [];
      updatedEnabled = false;
      setActiveBannerIndex(0);
      toast.info("Banner deleted. No banners currently on home page.");
    } else {
      updatedBanners = list.filter((_, idx) => idx !== indexToDelete);
      setActiveBannerIndex((prev) => (prev >= updatedBanners.length ? Math.max(0, updatedBanners.length - 1) : prev));
      toast.success("Banner deleted.");
    }
    const updated = { ...bannerConfig, banners: updatedBanners, enabled: updatedEnabled };
    setBannerConfig(updated);
    try {
      await dealBannerService.save(updated);
    } catch {
      // ignore
    }
  };

  const handleMoveBanner = (index: number, direction: "up" | "down") => {
    const list = [...bannerConfig.banners];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setBannerConfig({ ...bannerConfig, banners: list });
    setActiveBannerIndex(targetIdx);
  };

  const updateCurrentBanner = (patch: Partial<DealBannerItem>) => {
    const list = [...(bannerConfig.banners || [])];
    if (!list[activeBannerIndex]) return;
    list[activeBannerIndex] = {
      ...list[activeBannerIndex],
      ...patch,
    };
    setBannerConfig({ ...bannerConfig, banners: list });
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    setUploadingBannerImage(true);
    try {
      const publicUrl = await uploadProductImage(file);
      updateCurrentBanner({ imageUrl: publicUrl });
      toast.success("Banner photo uploaded successfully!");
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          updateCurrentBanner({ imageUrl: reader.result });
          toast.success("Banner photo loaded!");
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const handleSaveBanner = async () => {
    setSavingBanner(true);
    try {
      await dealBannerService.save(bannerConfig);
      toast.success("Home page Deals & Advertising Banners saved successfully!");
      setShowBannerModal(false);
    } catch {
      toast.error("Failed to save banner configuration");
    } finally {
      setSavingBanner(false);
    }
  };

  const handleRunAutoRefill = async () => {
    setRunningRefill(true);
    try {
      const res = await autoRefillService.processDailyAutoRefills();
      if (res.length > 0) {
        toast.success(`Daily Auto-Refill complete! Updated ${res.length} products with fresh stock.`);
      } else {
        toast.info("Auto-refill check complete. All scheduled daily products are currently up to date.");
      }
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to run auto-refill");
    } finally {
      setRunningRefill(false);
    }
  };

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

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast.info("No products to export");
      return;
    }
    const csv = exportProductsToCSV(products);
    downloadCSVFile(`odhavram_products_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${products.length} products to CSV`);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="admin-page-title">Products</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage catalog, multi-unit packaging & daily automated refills</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              dealBannerService.get().then((cfg) => {
                setBannerConfig(cfg);
                setActiveBannerIndex(0);
                setBannerViewMode("table");
              });
              setShowBannerModal(true);
            }}
            className="text-xs border-amber-300 text-amber-900 hover:bg-amber-50 font-semibold bg-amber-50/50"
            title="Manage Home Page Promotion Banners and Advertisements"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" /> Home Page Banners
          </Button>
          <Link href="/admin/inventory/quick-stock">
            <Button
              type="button"
              variant="outline"
              className="text-xs border-indigo-200 text-indigo-800 hover:bg-indigo-50"
              title="Quickly add stock or audit inventory shelf-by-shelf with a barcode scanner gun"
            >
              <ScanBarcode className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Quick Stock In
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowImportModal(true)}
            className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            title="Import hundreds of products and stock at once from Excel / CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Import CSV / Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs border-gray-200 text-gray-700 hover:bg-gray-50"
            title="Export all products to CSV spreadsheet"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-gray-500" /> Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowVerificationModal(true)}
            className="text-xs border-blue-200 text-blue-800 hover:bg-blue-50"
            title="Print a physical inventory verification and audit sheet"
          >
            <Printer className="h-3.5 w-3.5 mr-1 text-blue-600" /> Stock Audit Sheet
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={runningRefill}
            onClick={handleRunAutoRefill}
            className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 hidden sm:inline-flex"
            title="Checks and replenishes stock for items like milk and bread scheduled for today"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Auto-Refill
          </Button>
          <Button
            type="button"
            onClick={() => setShowSpreadsheet((s) => !s)}
            className="hidden sm:inline-flex bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold gap-1.5 shadow-sm"
            title="Add multiple products at once in an Excel spreadsheet grid"
          >
            <FileSpreadsheet className="h-4 w-4" /> Add Multiple (Excel Grid)
          </Button>
          <Button onClick={openCreate} className="hidden lg:inline-flex bg-emerald-700 hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      <AdminFab label="Add Product" icon={Plus} onClick={openCreate} />

      {/* Excel Spreadsheet Mode */}
      {showSpreadsheet && (
        <div className="mb-6">
          <MultiProductSpreadsheet
            categoriesList={categories}
            onSuccess={() => {
              load();
              setShowSpreadsheet(false);
            }}
            onCancel={() => setShowSpreadsheet(false)}
          />
        </div>
      )}

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
          <Input label="Selling Price (Incl. GST)" type="number" step="0.01" error={errors.price?.message} {...register("price")} />
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
          <Input label="Purchase Price (Incl. GST)" type="number" step="0.01" {...register("purchase_price")} />
          <Input label="MRP (Incl. GST)" type="number" step="0.01" {...register("mrp")} />
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

          {/* Loose Item (Sold by Weight / Scale) */}
          <div className="sm:col-span-2 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-purple-50/30 to-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    Loose Item (Sold by Weight / Scale)
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      Weight Scale Item
                    </span>
                  </h3>
                  <p className="text-xs text-gray-600">
                    For loose sugar, grains, pulses, flour, oil, etc. In POS, scanning or searching this product prompts for weight (grams/kg) or rupee value and calculates the price automatically.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register("is_loose", {
                    onChange: (e) => {
                      if (e.target.checked) {
                        const currentUnit = watch("unit");
                        if (!currentUnit || currentUnit === "pcs") {
                          setValue("unit", "kg");
                        }
                      }
                    },
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-xs font-bold text-gray-800">
                  {watch("is_loose") ? "Loose Item (Active)" : "Standard Item"}
                </span>
              </label>
            </div>
            {watch("is_loose") && (
              <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-200 p-2.5 text-xs text-indigo-900">
                <span className="font-bold block mb-0.5">⚖️ POS Weight Dialog Enabled</span>
                Price specified above (₹{watchPrice || 0}) is treated as <strong>Rate per {watch("unit") || "kg"}</strong>. When scanned in Quick POS or Invoice Billing, a weight entry popup will allow entering in grams (e.g. 250g, 500g) or target rupee amount (e.g. ₹50 worth).
              </div>
            )}
          </div>

          {/* Daily Auto-Refill (Milk, Bread, Daily Essentials) */}
          <div className="sm:col-span-2 rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    Daily Auto-Refill <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Daily Essentials: Milk, Bread, Dairy</span>
                  </h3>
                  <p className="text-xs text-gray-600">
                    Automatically replenishes fresh stock every day at user-fixed times without manual purchase entry.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register("auto_refill_enabled")}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2 text-xs font-bold text-gray-800">
                  {watchAutoRefillEnabled ? "Auto-Refill Active" : "Disabled"}
                </span>
              </label>
            </div>

            {watchAutoRefillEnabled && (
              <div className="mt-4 space-y-4">
                {/* Summary calculation pill */}
                <div className="rounded-lg bg-white border border-emerald-200 p-3 text-xs shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-emerald-900 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      Daily Refill Schedule:
                    </span>
                    <span className="font-semibold text-emerald-800">
                      Total Daily Stock In: +{watchAutoRefillQty + (watchSlot2Enabled ? watchSlot2Qty : 0)} units/day
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Slot 1 (Morning): +{watchAutoRefillQty || 0} units @ {watchAutoRefillTime}
                    {watchSlot2Enabled ? ` · Slot 2 (Afternoon): +${watchSlot2Qty || 0} units @ ${watchSlot2Time}` : " (1 refill per day)"}
                  </p>
                </div>

                {/* SLOT 1 (Morning Refill) */}
                <div className="rounded-lg border border-gray-200 bg-white/90 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      🌅 Slot 1 — Morning Batch (e.g. Morning Milk)
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium">Primary Refill</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Refill Quantity (Units to add)"
                      type="number"
                      min={1}
                      step="1"
                      placeholder="50"
                      error={errors.auto_refill_quantity?.message}
                      {...register("auto_refill_quantity")}
                    />
                    <div>
                      <label className="mb-1 block text-sm font-medium">Refill Time (24h)</label>
                      <input
                        type="time"
                        {...register("auto_refill_time")}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                      />
                      <div className="mt-1 flex flex-wrap gap-1">
                        {["05:00", "06:00", "07:00", "08:00"].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setValue("auto_refill_time", t)}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-emerald-100 hover:text-emerald-800"
                          >
                            {t === "05:00" ? "5 AM" : t === "06:00" ? "6 AM" : t === "07:00" ? "7 AM" : "8 AM"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SLOT 2 (Afternoon / Evening Refill) */}
                <div className="rounded-lg border border-gray-200 bg-white/90 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-900 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        {...register("auto_refill_slot2_enabled")}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      🌇 Slot 2 — Afternoon / Evening Batch (Optional 2nd Refill)
                    </label>
                    <span className="text-[11px] text-gray-500">2 times a day</span>
                  </div>

                  {watchSlot2Enabled && (
                    <div className="grid gap-3 sm:grid-cols-2 mt-3 pt-3 border-t border-gray-100 animate-in fade-in duration-150">
                      <Input
                        label="Afternoon Refill Quantity"
                        type="number"
                        min={1}
                        step="1"
                        placeholder="30"
                        error={errors.auto_refill_slot2_quantity?.message}
                        {...register("auto_refill_slot2_quantity")}
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium">Afternoon Time (24h)</label>
                        <input
                          type="time"
                          {...register("auto_refill_slot2_time")}
                          className="w-full rounded-lg border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="mt-1 flex flex-wrap gap-1">
                          {["15:00", "16:00", "17:00", "18:00"].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setValue("auto_refill_slot2_time", t)}
                              className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-emerald-100 hover:text-emerald-800"
                            >
                              {t === "15:00" ? "3 PM" : t === "16:00" ? "4 PM" : t === "17:00" ? "5 PM" : "6 PM"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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

      {/* Filter Tabs & Search Bar (Sticky above product list, beneath the 56px sticky top header) */}
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-2 pb-3 mb-4 bg-gray-50/95 backdrop-blur-xs border-b border-gray-200 shadow-2xs space-y-3 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              onClick={() => setFilterTab("offers")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                filterTab === "offers"
                  ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              )}
            >
              <Tag className="h-4 w-4 text-rose-500" />
              🔥 Offers &amp; Deals
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.2 text-xs font-bold",
                  filterTab === "offers" ? "bg-white/25 text-white" : "bg-rose-200 text-rose-900"
                )}
              >
                {offerProducts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                dealBannerService.get().then((cfg) => {
                  setBannerConfig(cfg);
                  setActiveBannerIndex(0);
                });
                setShowBannerModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 shadow-2xs"
            >
              <Sparkles className="h-4 w-4 text-amber-600" />
              📢 Home Page Banners
              <span className="ml-1 rounded-full px-1.5 py-0.2 text-xs font-bold bg-amber-200 text-amber-900">
                {(bannerConfig.banners || []).length}
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
              onClick={() => setFilterTab("autorefill")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                filterTab === "autorefill"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              )}
            >
              <Clock className="h-4 w-4" />
              Daily Auto-Refill
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.2 text-xs font-bold",
                  filterTab === "autorefill" ? "bg-white/25 text-white" : "bg-emerald-200 text-emerald-900"
                )}
              >
                {autoRefillProducts.length}
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
              placeholder="Search name, barcode, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* Category Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Category:
              </span>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Categories ({products.length})</option>
                {categories.map((c) => {
                  const count = products.filter(
                    (p) => p.category_id === c.id || p.categories?.id === c.id
                  ).length;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setGroupByCategory((prev) => !prev)}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5 transition",
                groupByCategory
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-2xs"
                  : "border-gray-200 text-gray-700 hover:bg-gray-100"
              )}
            >
              <FolderTree className="h-3.5 w-3.5" />
              {groupByCategory ? "Categorized Cards (Active)" : "Group by Category"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={openOfferModalForNew}
              className="h-8 gap-1.5 bg-gradient-to-r from-rose-600 to-amber-600 text-white hover:from-rose-700 hover:to-amber-700 text-xs font-semibold shadow-xs"
            >
              <Tag className="h-3.5 w-3.5" />
              + Create Offer on Product
            </Button>
          </div>
        </div>
      </div>

      {/* Offers & Deals Information Banner */}
      {filterTab === "offers" && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 p-4 text-sm text-rose-950 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-rose-950">Store Offers & Promotional Deals</h4>
                <p className="mt-0.5 text-xs text-rose-800">
                  Manage discounted prices, start &amp; end validity time periods, and customize the Deals Advertisement Banner on the home page.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  dealBannerService.get().then((cfg) => {
                    setBannerConfig(cfg);
                    setActiveBannerIndex(0);
                  });
                  setShowBannerModal(true);
                }}
                className="border-rose-300 text-rose-800 bg-white hover:bg-rose-50 text-xs font-semibold shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
                📢 Home Page Deals &amp; Banners
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={openOfferModalForNew}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Offer on Product
              </Button>
            </div>
          </div>
        </div>
      )}

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

      {/* Product Tables Rendering (Single or Category-Grouped) */}
      {(() => {
        const renderProductTable = (items: Product[], isGrouped = false) => (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
            {/* Scrollable table viewport */}
            <div
              className={cn(
                "overflow-x-auto overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400",
                isGrouped
                  ? "max-h-[380px]"
                  : "max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[360px]"
              )}
            >
              <table className="w-full min-w-[32rem] text-sm border-collapse">
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-gray-700 shadow-2xs">
                  <tr>
                    <th className="w-14 px-3 py-3 text-left bg-gray-50 font-bold">Photo</th>
                    <th className="px-4 py-3 text-left bg-gray-50 font-bold">Product &amp; Barcode</th>
                    <th className="px-4 py-3 text-left bg-gray-50 font-bold">Category</th>
                    <th className="px-4 py-3 text-left bg-gray-50 font-bold">Price &amp; MRP</th>
                    <th className="px-4 py-3 text-left bg-gray-50 font-bold">Stock</th>
                    <th className="px-4 py-3 text-left bg-gray-50 font-bold">Offer &amp; Deal</th>
                    <th className="px-4 py-3 text-right bg-gray-50 font-bold">Actions</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      {filterTab === "archived" ? (
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Archive className="h-7 w-7 text-gray-300" />
                          <p className="font-medium text-gray-700">No archived products</p>
                        </div>
                      ) : filterTab === "offers" ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Tag className="h-7 w-7 text-rose-300" />
                          <p className="font-medium text-gray-700">No active offers or deals yet</p>
                          <p className="text-xs text-gray-400">Click &quot;+ Create Offer&quot; above to set discounts on your products.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Package className="h-7 w-7 text-gray-300" />
                          <p className="font-medium text-gray-700">No products found</p>
                          <p className="text-xs text-gray-400">Try adjusting your search query or filters.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  items.map((p) => {
                    const isArchived = p.is_active === false;
                    const hasOffer = Boolean(p.mrp && p.mrp > p.price);
                    const discountPct = hasOffer && p.mrp ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "transition hover:bg-gray-50/70",
                          isArchived && "bg-amber-50/30"
                        )}
                      >
                        {/* Photo Column */}
                        <td className="px-3 py-3">
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shadow-2xs">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="h-full w-full object-contain p-0.5"
                                loading="lazy"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-gray-300" />
                            )}
                          </div>
                        </td>

                        {/* Name & Barcode */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn("font-medium text-gray-900", isArchived && "text-gray-600")}>
                              {p.name}
                            </span>
                            {isArchived && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300 shrink-0">
                                <Archive className="h-3 w-3" /> Archived
                              </span>
                            )}
                            {(p.auto_refill_enabled || p.auto_refill_slot2_enabled) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-300 shrink-0">
                                <Clock className="h-3 w-3 text-emerald-600" /> Daily Refill
                              </span>
                            )}
                            {p.is_loose && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 border border-indigo-200 shrink-0">
                                <Scale className="h-3 w-3 text-indigo-600" /> Loose ({p.unit || "kg"})
                              </span>
                            )}
                          </div>
                          {p.barcode && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">Barcode: {p.barcode}</p>
                          )}
                        </td>

                        {/* Category Column */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 border border-gray-200">
                            {p.categories?.name || "Uncategorized"}
                          </span>
                        </td>

                        {/* Price & MRP */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{formatPrice(p.price)}</div>
                          {hasOffer && (
                            <div className="text-xs text-gray-400 line-through">
                              MRP: {formatPrice(p.mrp!)}
                            </div>
                          )}
                        </td>

                        {/* Stock */}
                        <td className="px-4 py-3">
                          <span className={cn("font-medium", p.stock <= 5 ? "text-red-600 font-bold" : "text-gray-700")}>
                            {p.stock}
                          </span>
                        </td>

                        {/* Offer & Deal Column */}
                        <td className="px-4 py-3">
                          {hasOffer ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 border border-rose-200">
                                  <Tag className="h-3 w-3 text-rose-600" />
                                  {discountPct}% OFF
                                </span>
                                {p.featured && (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 border border-amber-300">
                                    ⭐ Deal
                                  </span>
                                )}
                              </div>
                              {p.offer_end_date && (() => {
                                const remaining = getOfferTimeRemaining(p.offer_end_date);
                                return (
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <Clock className={cn("h-3 w-3 shrink-0", remaining.isExpired ? "text-gray-400" : "text-amber-600")} />
                                    <span className={cn("font-medium", remaining.isExpired ? "text-gray-500 line-through" : "text-amber-800")}>
                                      {remaining.text}
                                    </span>
                                  </div>
                                );
                              })()}
                              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                <span>Saves {formatPrice(p.mrp! - p.price)}</span>
                                <button
                                  type="button"
                                  onClick={() => openOfferModal(p)}
                                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {p.featured && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 border border-amber-300">
                                  ⭐ Featured
                                </span>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openOfferModal(p)}
                                className="h-7 text-xs border-dashed border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              >
                                <Percent className="h-3 w-3 mr-1" /> + Create Offer
                              </Button>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
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

            {/* Table Footer status */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/90 px-4 py-2 text-xs text-gray-500">
              <span>
                Showing <strong className="font-semibold text-gray-800">{items.length}</strong> {items.length === 1 ? "product" : "products"}
              </span>
              <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
                Scroll inside table to view all items
              </span>
            </div>
          </div>
        );

        if (groupByCategory) {
          return (
            <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] pr-1 overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
              {groupedProductsByCategory.length === 0 ? (
                <div className="rounded-xl border bg-white p-12 text-center text-gray-500">
                  <Package className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">No products found</p>
                  <p className="text-xs text-gray-400">Try adjusting your filters or category selection.</p>
                </div>
              ) : (
                groupedProductsByCategory.map((group) => (
                  <div
                    key={group.key}
                    className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-gray-50 to-blue-50/50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-bold overflow-hidden shrink-0">
                          {group.category?.image ? (
                            <img
                              src={group.category.image}
                              alt={group.name}
                              className="h-full w-full object-contain p-0.5"
                            />
                          ) : (
                            <FolderTree className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                            {group.name}
                            <span className="rounded-full bg-blue-100 px-2 py-0.2 text-xs font-semibold text-blue-800">
                              {group.products.length} {group.products.length === 1 ? "item" : "items"}
                            </span>
                          </h3>
                          <p className="text-xs text-gray-500">
                            Products organized under {group.name}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openCreate(group.category ? group.category.id : undefined)}
                        className="text-xs h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add in this category
                      </Button>
                    </div>
                    {renderProductTable(group.products, true)}
                  </div>
                ))
              )}
            </div>
          );
        }

        return renderProductTable(displayedProducts);
      })()}

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

      {/* Bulk Product & Stock Import Modal */}
      <BulkProductImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          load();
        }}
      />

      <StockVerificationModal
        open={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        products={products}
        categories={categories}
      />

      {/* Create / Edit Product Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b p-4 sm:p-5 pb-3.5 shrink-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-2xs">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {offerModalProduct ? "Edit Product Offer & Discount" : "Create Product Offer"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Set discount selling price, strikethrough MRP, and deals
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfferModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body with dedicated scrollbar */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
              {/* Product selection or selected product summary */}
              {offerModalProduct ? (
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white flex items-center justify-center shadow-2xs">
                    {offerModalProduct.image_url ? (
                      <img
                        src={offerModalProduct.image_url}
                        alt={offerModalProduct.name}
                        className="h-full w-full object-contain p-0.5"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-gray-900 truncate text-sm">
                      {offerModalProduct.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span>Current Price: <strong>{formatPrice(offerModalProduct.price)}</strong></span>
                      {offerModalProduct.categories?.name && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.2 text-[10px] font-medium text-gray-700">
                          {offerModalProduct.categories.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Select Product for Offer
                  </label>
                  <select
                    value={selectedOfferProductManualId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setSelectedOfferProductManualId(pid);
                      const sel = activeProducts.find((p) => p.id === pid);
                      if (sel) {
                        setOfferMrp(Number(sel.mrp || sel.price));
                        setOfferPrice(Number(sel.price));
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-2xs focus:border-blue-500 focus:outline-none"
                  >
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Current: ₹{p.price} {p.barcode ? `(${p.barcode})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    Original MRP (₹)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Original MRP"
                    value={offerMrp || ""}
                    onChange={(e) => setOfferMrp(parseFloat(e.target.value) || 0)}
                    className="font-medium"
                  />
                  <span className="text-[11px] text-gray-400">Shown with strikethrough</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    Special Offer Price (₹)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Discounted Price"
                    value={offerPrice || ""}
                    onChange={(e) => setOfferPrice(parseFloat(e.target.value) || 0)}
                    className="font-bold text-rose-600 border-rose-300 focus:border-rose-500"
                  />
                  <span className="text-[11px] text-rose-600 font-medium">Selling price charged to customer</span>
                </div>
              </div>

              {/* Quick Discount Presets */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Quick Discount Presets
                </label>
                <div className="flex flex-wrap gap-2">
                  {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyDiscountPreset(pct)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 transition hover:bg-rose-100 hover:border-rose-300 active:scale-95"
                    >
                      {pct}% OFF
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Offer preview calculation */}
              {offerMrp > 0 && offerPrice > 0 && offerMrp > offerPrice && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-950">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-rose-700">
                      <Tag className="h-4 w-4" />
                      Discount: {Math.round(((offerMrp - offerPrice) / offerMrp) * 100)}% OFF
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      Customer Saves: {formatPrice(offerMrp - offerPrice)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-rose-800">
                    Product will show {formatPrice(offerMrp)} crossed out and selling at {formatPrice(offerPrice)}.
                  </p>
                </div>
              )}

              {/* Offer Time Period / Validity Duration */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-800">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Offer Validity Time Period
                  </label>
                  {offerEndDate && (() => {
                    const remaining = getOfferTimeRemaining(offerEndDate);
                    return (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold border",
                        remaining.isExpired
                          ? "bg-gray-200 text-gray-700 border-gray-300"
                          : "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                      )}>
                        ⏱️ {remaining.text}
                      </span>
                    );
                  })()}
                </div>

                {/* Quick Validity Presets */}
                <div>
                  <span className="block text-[11px] font-semibold text-gray-500 mb-1.5">
                    Quick Validity Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: "24h", label: "24 Hours (Flash)" },
                      { key: "3d", label: "3 Days" },
                      { key: "7d", label: "7 Days (1 Wk)" },
                      { key: "eom", label: "End of Month" },
                      { key: "none", label: "No Expiry" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => applyValidityPreset(item.key as any)}
                        className="rounded-lg border border-amber-300 bg-amber-50/80 px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 hover:border-amber-400 active:scale-95"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <span className="block text-[11px] font-medium text-gray-600 mb-1">
                      Offer Start Date &amp; Time
                    </span>
                    <Input
                      type="datetime-local"
                      value={offerStartDate}
                      onChange={(e) => setOfferStartDate(e.target.value)}
                      className="text-xs h-9 bg-white"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-medium text-gray-600 mb-1">
                      Offer End Date &amp; Time (Expiry)
                    </span>
                    <Input
                      type="datetime-local"
                      value={offerEndDate}
                      onChange={(e) => setOfferEndDate(e.target.value)}
                      className="text-xs h-9 bg-white border-amber-300 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Featured deal checkbox */}
              <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={offerFeatured}
                  onChange={(e) => setOfferFeatured(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-amber-950">Highlight as Featured Deal</span>
                  <p className="text-amber-800 mt-0.5">
                    Display prominently with special deal badge on website homepage and mobile app
                  </p>
                </div>
              </label>
            </div>

            {/* Sticky Modal Footer */}
            <div className="flex items-center justify-between gap-3 border-t p-4 sm:p-5 shrink-0 bg-gray-50/95 backdrop-blur-xs z-10">
              {offerModalProduct &&
              ((offerModalProduct.mrp && offerModalProduct.mrp > offerModalProduct.price) ||
                offerModalProduct.featured) ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingOffer}
                  onClick={handleRemoveOffer}
                  className="text-xs border-red-200 text-red-700 hover:bg-red-50"
                >
                  Remove Offer
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingOffer}
                  onClick={() => setShowOfferModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  loading={savingOffer}
                  onClick={handleSaveOffer}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Apply &amp; Save Offer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Home Page Deals & Advertising Banners Modal */}
      {showBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header (Fixed) */}
            <div className="flex items-center justify-between border-b p-4 sm:p-5 pb-3.5 shrink-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-2xs">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    Home Page Deals &amp; Advertising Banners
                  </h3>
                  <p className="text-xs text-gray-500">
                    Manage promotional banners, photo graphics, countdown deals &amp; real-time expiry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBannerModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Top Toolbar: Mode Switcher, Master Storefront Switch & Quick Add Buttons */}
            <div className="shrink-0 px-4 sm:px-5 pt-3 pb-3 border-b bg-gray-50/80 space-y-3 z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Mode Switcher Tabs */}
                <div className="inline-flex rounded-xl bg-gray-200/80 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setBannerViewMode("table")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                      bannerViewMode === "table"
                        ? "bg-white text-gray-900 shadow-xs font-bold"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <TableIcon className="h-3.5 w-3.5 text-amber-600" />
                    <span>Banners Table</span>
                    <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                      {(bannerConfig.banners || []).length}
                    </span>
                  </button>
                  {(bannerConfig.banners || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBannerViewMode("edit")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                        bannerViewMode === "edit"
                          ? "bg-white text-gray-900 shadow-xs font-bold"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5 text-blue-600" />
                      <span>Edit Banner #{activeBannerIndex + 1}</span>
                    </button>
                  )}
                </div>

                {/* Add Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddBanner("deal")}
                    className="bg-white hover:bg-rose-50 border-rose-200 text-rose-700 text-xs font-semibold shadow-2xs"
                  >
                    <Tag className="h-3.5 w-3.5 mr-1" /> + Add Deals Banner
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddBanner("photo")}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs"
                  >
                    <ImageIcon className="h-3.5 w-3.5 mr-1" /> + Add Photo Banner
                  </Button>
                </div>
              </div>

              {/* Master Visibility Switch & Summary Metrics */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 sm:px-3.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bannerConfig.enabled}
                    onChange={(e) => setBannerConfig({ ...bannerConfig, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-gray-900">
                      Display Banners on Home Page
                    </span>
                    <span className="text-[11px] text-gray-600 block sm:inline sm:ml-2">
                      (Master switch for carousel on storefront)
                    </span>
                  </div>
                </label>

                {/* Counter Badges */}
                {(() => {
                  const banners = bannerConfig.banners || [];
                  const liveCount = banners.filter(
                    (b) => b.enabled && (!b.endDate || !getOfferTimeRemaining(b.endDate).isExpired)
                  ).length;
                  const expiredCount = banners.filter(
                    (b) => b.endDate && getOfferTimeRemaining(b.endDate).isExpired
                  ).length;
                  const disabledCount = banners.filter((b) => !b.enabled).length;

                  return (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-2 py-0.5 text-[11px] text-gray-700 shadow-2xs">
                        Total: <strong className="font-bold">{banners.length}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 text-[11px] font-bold text-emerald-800 shadow-2xs">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live on Home: {bannerConfig.enabled ? liveCount : 0}
                      </span>
                      {expiredCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 border border-red-300 px-2 py-0.5 text-[11px] font-bold text-red-800 shadow-2xs">
                          <AlertCircle className="h-3 w-3 text-red-600" />
                          Expired (Deleted from Home): {expiredCount}
                        </span>
                      )}
                      {disabledCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 border border-gray-300 px-2 py-0.5 text-[11px] text-gray-600">
                          Paused: {disabledCount}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Scrollable Form Body with dedicated visible scrollbar */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
              {/* Empty state when 0 banners exist */}
              {(bannerConfig.banners || []).length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-8 text-center space-y-3 my-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-2xs">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">No Banners Configured</h4>
                    <p className="text-xs text-gray-600 max-w-md mx-auto mt-1">
                      There are currently no banners configured for the home page. Add a Deals Countdown Banner or a Photo Advertising Graphic Banner to get started!
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddBanner("deal")}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs"
                    >
                      <Tag className="h-3.5 w-3.5 mr-1" /> + Create Deals Banner
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddBanner("photo")}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                    >
                      <ImageIcon className="h-3.5 w-3.5 mr-1" /> + Create Photo Banner
                    </Button>
                  </div>
                </div>
              ) : bannerViewMode === "table" ? (
                /* TABLE VIEW FORMAT */
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                        Banners Status Table ({(bannerConfig.banners || []).length})
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Expired banners are hidden from the store home page and listed below
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveBannerIndex(0);
                        setBannerViewMode("edit");
                      }}
                      className="text-xs font-semibold"
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Switch to Editor
                    </Button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs text-gray-700 border-collapse">
                      <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3 min-w-[220px]">Banner Details</th>
                          <th className="py-2.5 px-3 w-28">Type &amp; Theme</th>
                          <th className="py-2.5 px-3 min-w-[170px]">Countdown &amp; Expiry</th>
                          <th className="py-2.5 px-3 min-w-[170px]">Home Page Status</th>
                          <th className="py-2.5 px-3 text-right min-w-[200px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bannerConfig.banners.map((banner, index) => {
                          const rem = banner.endDate ? getOfferTimeRemaining(banner.endDate) : null;
                          const isExpired = rem ? rem.isExpired : false;

                          return (
                            <tr
                              key={banner.id || index}
                              className={cn(
                                "hover:bg-gray-50/80 transition",
                                isExpired ? "bg-red-50/40" : ""
                              )}
                            >
                              {/* Order & Reorder Column */}
                              <td className="py-3 px-3 text-center align-middle">
                                <span className="font-bold text-gray-600 text-xs">#{index + 1}</span>
                                {(bannerConfig.banners || []).length > 1 && (
                                  <div className="flex flex-col items-center mt-1">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => handleMoveBanner(index, "up")}
                                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 p-0.5"
                                      title="Move Up"
                                    >
                                      <ChevronLeft className="h-3 w-3 rotate-90" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === (bannerConfig.banners || []).length - 1}
                                      onClick={() => handleMoveBanner(index, "down")}
                                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 p-0.5"
                                      title="Move Down"
                                    >
                                      <ChevronRight className="h-3 w-3 rotate-90" />
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Banner Preview & Content */}
                              <td className="py-3 px-3 align-middle">
                                <div className="flex items-start gap-2.5">
                                  {banner.type === "photo" && banner.imageUrl ? (
                                    <div className="h-10 w-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shrink-0">
                                      <img
                                        src={banner.imageUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 shadow-2xs",
                                        banner.type === "photo"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-rose-100 text-rose-700"
                                      )}
                                    >
                                      {banner.type === "photo" ? (
                                        <ImageIcon className="h-5 w-5" />
                                      ) : (
                                        <Tag className="h-5 w-5" />
                                      )}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-gray-900 text-xs">
                                        {banner.title || "Untitled Banner"}
                                      </span>
                                      {banner.badgeText && (
                                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600">
                                          {banner.badgeText}
                                        </span>
                                      )}
                                      {banner.discountHighlight && (
                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800">
                                          {banner.discountHighlight}
                                        </span>
                                      )}
                                    </div>
                                    {banner.subtitle && (
                                      <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                                        {banner.subtitle}
                                      </p>
                                    )}
                                    {banner.buttonLink && (
                                      <span className="text-[10px] text-blue-600 font-mono mt-0.5 block truncate max-w-xs">
                                        Link: {banner.buttonLink}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Type & Theme */}
                              <td className="py-3 px-3 align-middle">
                                <div className="space-y-1">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                      banner.type === "photo"
                                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                                        : "bg-rose-50 text-rose-700 border border-rose-200"
                                    )}
                                  >
                                    {banner.type === "photo" ? (
                                      <ImageIcon className="h-2.5 w-2.5" />
                                    ) : (
                                      <Tag className="h-2.5 w-2.5" />
                                    )}
                                    {banner.type === "photo" ? "Photo Ad" : "Flash Deal"}
                                  </span>
                                  <div>
                                    <span className="capitalize text-[10px] font-medium text-gray-500 block">
                                      Theme: {banner.theme || "flame"}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Countdown & Expiry Status */}
                              <td className="py-3 px-3 align-middle">
                                {isExpired ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-extrabold text-red-800 border border-red-300">
                                      <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />
                                      EXPIRED
                                    </span>
                                    <p className="text-[10px] text-red-700 font-medium">
                                      Countdown completed
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-mono">
                                      {banner.endDate === "realtime_daily"
                                        ? "Daily flash passed"
                                        : banner.endDate
                                        ? new Date(banner.endDate).toLocaleDateString()
                                        : "Expired"}
                                    </p>
                                  </div>
                                ) : rem ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                                      <Clock className="h-3 w-3 text-emerald-600 animate-pulse" />
                                      LIVE COUNTDOWN
                                    </span>
                                    <p className="text-[11px] font-mono font-bold text-emerald-900">
                                      {rem.text}
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                      {banner.endDate === "realtime_daily" || banner.timerMode === "realtime_daily"
                                        ? "Ends 23:59:59 tonight"
                                        : banner.endDate === "weekend"
                                        ? "Ends Sunday midnight"
                                        : "Custom target date"}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-gray-600">
                                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                                      Always Active
                                    </span>
                                    <p className="text-[10px] text-gray-400 mt-0.5">No timer set</p>
                                  </div>
                                )}
                              </td>

                              {/* Home Page Status */}
                              <td className="py-3 px-3 align-middle">
                                {isExpired ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow-2xs">
                                      ❌ DELETED FROM HOME
                                    </span>
                                    <p className="text-[10px] text-red-700 font-medium">
                                      Hidden from customers
                                    </p>
                                  </div>
                                ) : !banner.enabled ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                                      ⏸️ Paused (Disabled)
                                    </span>
                                    <p className="text-[10px] text-gray-400">Turned off by admin</p>
                                  </div>
                                ) : !bannerConfig.enabled ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-300">
                                      ⚠️ Carousel Off
                                    </span>
                                    <p className="text-[10px] text-amber-700">Master switch off</p>
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow-2xs">
                                      🟢 LIVE ON HOME
                                    </span>
                                    <p className="text-[10px] text-emerald-700 font-medium">
                                      Visible to customers
                                    </p>
                                  </div>
                                )}
                              </td>

                              {/* Row Actions */}
                              <td className="py-3 px-3 align-middle text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {isExpired && (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleRenewBanner(index, "today")}
                                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-2 py-1 h-7 shadow-xs"
                                        title="Renew banner to count down until 23:59:59 tonight and re-display on home page"
                                      >
                                        ⚡ Renew Today
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRenewBanner(index, "3d")}
                                        className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold text-[10px] px-1.5 py-1 h-7"
                                        title="Extend countdown by 3 days"
                                      >
                                        +3d
                                      </Button>
                                    </>
                                  )}

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setActiveBannerIndex(index);
                                      setBannerViewMode("edit");
                                    }}
                                    className="text-xs font-semibold px-2 py-1 h-7 border-gray-300 text-gray-700 hover:bg-gray-100"
                                    title="Edit banner content, timing, or photo"
                                  >
                                    <Pencil className="h-3 w-3 mr-1" /> Edit
                                  </Button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleBannerEnabled(index)}
                                    className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                                    title={banner.enabled ? "Hide from home page" : "Enable banner"}
                                  >
                                    {banner.enabled ? (
                                      <Eye className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBanner(index)}
                                    className="p-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                                    title="Permanently delete this banner"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* EDIT FORM VIEW */
                (() => {
                  const currentBanner = (bannerConfig.banners || [])[activeBannerIndex];
                  if (!currentBanner) return null;

                  const rem = currentBanner.endDate ? getOfferTimeRemaining(currentBanner.endDate) : null;
                  const isCurrentExpired = rem ? rem.isExpired : false;

                  return (
                    <div className="space-y-4">
                      {/* Sub-header: Back Button & Banner Tabs */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setBannerViewMode("table")}
                          className="text-xs font-semibold text-gray-700 hover:bg-gray-100 self-start"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to Banners Table
                        </Button>

                        {/* Banner Tabs Strip */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                          {(bannerConfig.banners || []).map((banner, index) => {
                            const isSelected = index === activeBannerIndex;
                            const bRem = banner.endDate ? getOfferTimeRemaining(banner.endDate) : null;
                            const bExpired = bRem ? bRem.isExpired : false;

                            return (
                              <button
                                key={banner.id || index}
                                type="button"
                                onClick={() => setActiveBannerIndex(index)}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition shrink-0",
                                  isSelected
                                    ? "border-blue-600 bg-blue-50/80 text-blue-900 shadow-2xs ring-1 ring-blue-500"
                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                )}
                              >
                                {banner.type === "photo" ? (
                                  <ImageIcon className="h-3 w-3 text-blue-600" />
                                ) : (
                                  <Tag className="h-3 w-3 text-rose-600" />
                                )}
                                <span className="truncate max-w-[100px]">
                                  {banner.title || `Banner #${index + 1}`}
                                </span>
                                {bExpired ? (
                                  <span className="rounded bg-red-600 px-1 py-0.2 text-[9px] font-bold text-white">
                                    EXPIRED
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      "h-2 w-2 rounded-full",
                                      banner.enabled ? "bg-emerald-500" : "bg-gray-300"
                                    )}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Expired Banner Alert Notice if expired */}
                      {isCurrentExpired && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-3.5 text-red-900">
                          <div className="flex items-center gap-2.5">
                            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-red-900">
                                🔴 This banner is EXPIRED and has been automatically deleted from the Home Page.
                              </p>
                              <p className="text-[11px] text-red-700">
                                Customers cannot see it. Click &quot;Renew for Today&quot; or update the countdown below to make it visible again.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleRenewBanner(activeBannerIndex, "today")}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
                            >
                              ⚡ Renew for Today
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleRenewBanner(activeBannerIndex, "3d")}
                              className="border-red-300 text-red-800 hover:bg-red-100 text-xs font-semibold"
                            >
                              +3 Days
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5 space-y-4">
                  {/* Banner Header & Type Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                        Banner Type:
                      </span>
                      <div className="flex items-center gap-1 rounded-xl bg-gray-200/70 p-1">
                        <button
                          type="button"
                          onClick={() => updateCurrentBanner({ type: "deal" })}
                          className={cn(
                            "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition",
                            currentBanner.type === "deal"
                              ? "bg-white text-gray-900 shadow-xs"
                              : "text-gray-600 hover:text-gray-900"
                          )}
                        >
                          <Tag className="h-3.5 w-3.5 text-rose-600" />
                          🏷️ Deals Banner
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCurrentBanner({ type: "photo" })}
                          className={cn(
                            "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition",
                            currentBanner.type === "photo"
                              ? "bg-white text-gray-900 shadow-xs"
                              : "text-gray-600 hover:text-gray-900"
                          )}
                        >
                          <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                          📸 Photo Advertising Banner
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={currentBanner.enabled}
                          onChange={(e) => updateCurrentBanner({ enabled: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-gray-800">
                          Active in Carousel
                        </span>
                      </label>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBanner(activeBannerIndex)}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-xs font-semibold shrink-0"
                        title="Delete this banner"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete This Banner
                      </Button>
                    </div>
                  </div>

                  {/* PHOTO ADVERTISING BANNER CONTROLS */}
                  {currentBanner.type === "photo" ? (
                    <div className="space-y-4">
                      {/* Image Upload & URL */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                          Advertising Photo / Graphic Image
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-4 hover:border-blue-500 transition cursor-pointer text-center">
                              <Upload className="h-6 w-6 text-gray-400 mb-1" />
                              <span className="text-xs font-bold text-gray-800">
                                {uploadingBannerImage ? "Uploading..." : "Upload Photo from PC"}
                              </span>
                              <span className="text-[10px] text-gray-400 mt-0.5">
                                Recommended: 1200x400 or widescreen banner
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleBannerImageUpload}
                                disabled={uploadingBannerImage}
                                className="hidden"
                              />
                            </label>
                          </div>

                          <div>
                            <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                              Or Paste Direct Image URL:
                            </span>
                            <Input
                              value={currentBanner.imageUrl || ""}
                              onChange={(e) => updateCurrentBanner({ imageUrl: e.target.value })}
                              placeholder="https://images.unsplash.com/... or storage URL"
                              className="text-xs"
                            />
                            <span className="text-[10px] text-gray-400 mt-1 block">
                              Supports JPG, PNG, WebP image links
                            </span>
                          </div>
                        </div>

                        {/* Photo Preview */}
                        {currentBanner.imageUrl && (
                          <div className="mt-3 relative rounded-xl overflow-hidden border border-gray-200 bg-gray-950 aspect-[24/9] max-h-48 w-full group">
                            <img
                              src={currentBanner.imageUrl}
                              alt="Banner Preview"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex flex-col justify-end text-white">
                              <span className="inline-block rounded-full bg-amber-400 text-gray-950 px-2 py-0.5 text-[10px] font-black w-fit mb-1">
                                {currentBanner.discountHighlight || "SPECIAL PROMOTION"}
                              </span>
                              <h4 className="font-bold text-sm sm:text-base line-clamp-1">
                                {currentBanner.title}
                              </h4>
                              {currentBanner.subtitle && (
                                <p className="text-xs text-white/80 line-clamp-1">
                                  {currentBanner.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Click Target URL */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                          Click Destination Link (Target URL)
                        </label>
                        <Input
                          value={currentBanner.targetUrl || currentBanner.buttonLink || ""}
                          onChange={(e) => updateCurrentBanner({ targetUrl: e.target.value, buttonLink: e.target.value })}
                          placeholder="e.g. /products?category=fruits, /products?deals=true, or full URL"
                          className="text-xs font-mono"
                        />
                        <span className="text-[11px] text-gray-500 mt-0.5 block">
                          Customers will be taken to this page when they click anywhere on the advertising banner.
                        </span>
                      </div>

                      {/* Headline Title & Subtitle */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Banner Headline Overlay
                          </label>
                          <Input
                            value={currentBanner.title}
                            onChange={(e) => updateCurrentBanner({ title: e.target.value })}
                            placeholder="e.g. 🛒 Fresh Farm Produce Bonanza"
                            className="text-sm font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Subtitle / Promotional Details
                          </label>
                          <Input
                            value={currentBanner.subtitle || ""}
                            onChange={(e) => updateCurrentBanner({ subtitle: e.target.value })}
                            placeholder="e.g. Crisp greens, fruits & staples at wholesale prices."
                            className="text-xs"
                          />
                        </div>
                      </div>

                      {/* Badge Text, Discount Pill & Button Label */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Promotional Badge
                          </label>
                          <Input
                            value={currentBanner.badgeText || ""}
                            onChange={(e) => updateCurrentBanner({ badgeText: e.target.value })}
                            placeholder="e.g. PHOTO ADVERTISEMENT"
                            className="text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Discount Pill
                          </label>
                          <Input
                            value={currentBanner.discountHighlight || ""}
                            onChange={(e) => updateCurrentBanner({ discountHighlight: e.target.value })}
                            placeholder="e.g. FLAT 25% OFF"
                            className="text-xs font-bold text-amber-700"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Button Text
                          </label>
                          <Input
                            value={currentBanner.buttonText || ""}
                            onChange={(e) => updateCurrentBanner({ buttonText: e.target.value })}
                            placeholder="e.g. Shop Collection"
                            className="text-xs"
                          />
                        </div>
                      </div>

                      {/* Expiry Date */}
                      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Offer Expiry / Countdown Timer (Optional)
                        </label>

                        {/* Mode Buttons */}
                        <div className="grid grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCurrentBanner({ endDate: "realtime_daily", timerMode: "realtime_daily" })}
                            className={cn(
                              "px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 border",
                              (currentBanner.endDate === "realtime_daily" || currentBanner.timerMode === "realtime_daily")
                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            <Sparkles className="h-3 w-3" /> Daily Flash
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCurrentBanner({ endDate: "weekend", timerMode: "weekend" })}
                            className={cn(
                              "px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 border",
                              (currentBanner.endDate === "weekend" || currentBanner.timerMode === "weekend")
                                ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            <Calendar className="h-3 w-3" /> Weekend
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                              updateCurrentBanner({ endDate: in3Days.toISOString(), timerMode: "custom" });
                            }}
                            className={cn(
                              "px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 border",
                              (currentBanner.timerMode === "custom" || (currentBanner.endDate && currentBanner.endDate !== "realtime_daily" && currentBanner.endDate !== "weekend"))
                                ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            <Clock className="h-3 w-3" /> Custom Date
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCurrentBanner({ endDate: "", timerMode: undefined })}
                            className={cn(
                              "px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 border",
                              !currentBanner.endDate
                                ? "bg-gray-700 text-white border-gray-800 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            No Timer
                          </button>
                        </div>

                        {/* Custom Date Input if custom */}
                        {(currentBanner.timerMode === "custom" || (currentBanner.endDate && currentBanner.endDate !== "realtime_daily" && currentBanner.endDate !== "weekend")) && (
                          <div className="space-y-2 pt-1">
                            <Input
                              type="datetime-local"
                              value={(() => {
                                if (!currentBanner.endDate || currentBanner.endDate === "realtime_daily" || currentBanner.endDate === "weekend") return "";
                                const d = new Date(currentBanner.endDate);
                                if (isNaN(d.getTime())) return "";
                                const pad = (n: number) => String(n).padStart(2, "0");
                                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                              })()}
                              onChange={(e) =>
                                updateCurrentBanner({
                                  endDate: e.target.value ? new Date(e.target.value).toISOString() : "",
                                  timerMode: "custom",
                                })
                              }
                              className="text-xs bg-white"
                            />
                            {/* Quick Presets */}
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] text-gray-500 font-semibold mr-1">Presets:</span>
                              {[
                                { label: "+24 Hours", hours: 24 },
                                { label: "+3 Days", hours: 72 },
                                { label: "+7 Days", hours: 168 },
                              ].map((p) => (
                                <button
                                  key={p.label}
                                  type="button"
                                  onClick={() => {
                                    const d = new Date(Date.now() + p.hours * 60 * 60 * 1000);
                                    updateCurrentBanner({ endDate: d.toISOString(), timerMode: "custom" });
                                  }}
                                  className="rounded px-2 py-0.5 text-[10px] font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition"
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Live Real-Time Remaining Preview */}
                        {currentBanner.endDate && (() => {
                          const rem = getOfferTimeRemaining(currentBanner.endDate);
                          return (
                            <div className="flex items-center gap-2 rounded-lg bg-amber-100/70 border border-amber-300/80 px-3 py-1.5 text-xs text-amber-950 font-medium">
                              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 animate-pulse" />
                              <span>Live Clock Remaining:</span>
                              <span className="font-mono font-bold text-amber-900">
                                {rem.days > 0 ? `${rem.days}d ` : ""}
                                {String(rem.hours).padStart(2, "0")}h : {String(rem.minutes).padStart(2, "0")}m : {String(rem.seconds).padStart(2, "0")}s
                              </span>
                              <span className="text-[10px] text-amber-700/80">({rem.text})</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* DEALS BANNER CONTROLS */
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                          Banner Headline Title
                        </label>
                        <Input
                          value={currentBanner.title}
                          onChange={(e) => updateCurrentBanner({ title: e.target.value })}
                          placeholder="e.g. ⚡ Mega Savings & Flash Grocery Deals!"
                          className="text-sm font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                          Subtitle / Description
                        </label>
                        <Input
                          value={currentBanner.subtitle || ""}
                          onChange={(e) => updateCurrentBanner({ subtitle: e.target.value })}
                          placeholder="e.g. Save big on daily groceries, snacks & household essentials."
                          className="text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Promotional Badge
                          </label>
                          <Input
                            value={currentBanner.badgeText || ""}
                            onChange={(e) => updateCurrentBanner({ badgeText: e.target.value })}
                            placeholder="e.g. LIMITED TIME DEALS"
                            className="text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Discount Highlight Pill
                          </label>
                          <Input
                            value={currentBanner.discountHighlight || ""}
                            onChange={(e) => updateCurrentBanner({ discountHighlight: e.target.value })}
                            placeholder="e.g. UP TO 50% OFF"
                            className="text-xs font-bold text-amber-700"
                          />
                        </div>
                      </div>

                      {/* Banner Expiry / Countdown Timer */}
                      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Banner Countdown End Date &amp; Time
                        </label>

                        {/* Mode Buttons */}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => updateCurrentBanner({ endDate: "realtime_daily", timerMode: "realtime_daily" })}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border",
                              (!currentBanner.endDate || currentBanner.endDate === "realtime_daily" || currentBanner.timerMode === "realtime_daily")
                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            <Sparkles className="h-3 w-3" /> Real-Time Daily
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCurrentBanner({ endDate: "weekend", timerMode: "weekend" })}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border",
                              (currentBanner.endDate === "weekend" || currentBanner.timerMode === "weekend")
                                ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            <Calendar className="h-3 w-3" /> Weekend Special
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                              updateCurrentBanner({ endDate: in3Days.toISOString(), timerMode: "custom" });
                            }}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border",
                              (currentBanner.timerMode === "custom" || (currentBanner.endDate && currentBanner.endDate !== "realtime_daily" && currentBanner.endDate !== "weekend"))
                                ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            <Clock className="h-3 w-3" /> Custom Date
                          </button>
                        </div>

                        {/* Custom Date Input if custom */}
                        {(currentBanner.timerMode === "custom" || (currentBanner.endDate && currentBanner.endDate !== "realtime_daily" && currentBanner.endDate !== "weekend")) && (
                          <div className="space-y-2 pt-1">
                            <Input
                              type="datetime-local"
                              value={(() => {
                                if (!currentBanner.endDate || currentBanner.endDate === "realtime_daily" || currentBanner.endDate === "weekend") return "";
                                const d = new Date(currentBanner.endDate);
                                if (isNaN(d.getTime())) return "";
                                const pad = (n: number) => String(n).padStart(2, "0");
                                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                              })()}
                              onChange={(e) =>
                                updateCurrentBanner({
                                  endDate: e.target.value ? new Date(e.target.value).toISOString() : "",
                                  timerMode: "custom",
                                })
                              }
                              className="text-xs bg-white"
                            />
                            {/* Quick Presets */}
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] text-gray-500 font-semibold mr-1">Presets:</span>
                              {[
                                { label: "+24 Hours", hours: 24 },
                                { label: "+3 Days", hours: 72 },
                                { label: "+7 Days", hours: 168 },
                              ].map((p) => (
                                <button
                                  key={p.label}
                                  type="button"
                                  onClick={() => {
                                    const d = new Date(Date.now() + p.hours * 60 * 60 * 1000);
                                    updateCurrentBanner({ endDate: d.toISOString(), timerMode: "custom" });
                                  }}
                                  className="rounded px-2 py-0.5 text-[10px] font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition"
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Live Real-Time Remaining Preview */}
                        {(() => {
                          const rem = getOfferTimeRemaining(currentBanner.endDate || "realtime_daily");
                          return (
                            <div className="flex items-center gap-2 rounded-lg bg-amber-100/70 border border-amber-300/80 px-3 py-1.5 text-xs text-amber-950 font-medium">
                              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 animate-pulse" />
                              <span>Live Clock Remaining:</span>
                              <span className="font-mono font-bold text-amber-900">
                                {rem.days > 0 ? `${rem.days}d ` : ""}
                                {String(rem.hours).padStart(2, "0")}h : {String(rem.minutes).padStart(2, "0")}m : {String(rem.seconds).padStart(2, "0")}s
                              </span>
                              <span className="text-[10px] text-amber-700/80">({rem.text})</span>
                            </div>
                          );
                        })()}
                        <span className="text-[11px] text-gray-500 block">
                          The live countdown clock counts down to this target in real time and never resets on website startup.
                        </span>
                      </div>

                      {/* Theme Selector */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                          Banner Color Theme
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: "flame", label: "Flame Red", bg: "bg-gradient-to-r from-rose-600 to-amber-600" },
                            { id: "royal", label: "Royal Blue", bg: "bg-gradient-to-r from-blue-900 to-indigo-800" },
                            { id: "emerald", label: "Emerald", bg: "bg-gradient-to-r from-emerald-800 to-teal-700" },
                            { id: "amber", label: "Amber Sun", bg: "bg-gradient-to-r from-amber-600 to-rose-600" },
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => updateCurrentBanner({ theme: t.id as any })}
                              className={cn(
                                "rounded-xl p-2 text-center text-xs font-bold text-white transition border-2",
                                t.bg,
                                currentBanner.theme === t.id
                                  ? "border-black ring-2 ring-blue-500 scale-105"
                                  : "border-transparent opacity-80 hover:opacity-100"
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Button Label
                          </label>
                          <Input
                            value={currentBanner.buttonText || ""}
                            onChange={(e) => updateCurrentBanner({ buttonText: e.target.value })}
                            placeholder="e.g. Shop Deals Now"
                            className="text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                            Button Target Link
                          </label>
                          <Input
                            value={currentBanner.buttonLink || ""}
                            onChange={(e) => updateCurrentBanner({ buttonLink: e.target.value })}
                            placeholder="e.g. /products?deals=true"
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setBannerViewMode("table")}
                      className="text-gray-600 hover:text-gray-900 text-xs font-semibold"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to Banners Table
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px] hidden sm:inline">
                        Editing #{activeBannerIndex + 1} of {(bannerConfig.banners || []).length}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBanner(activeBannerIndex)}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-xs font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete This Banner
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Sticky Modal Footer (Fixed at bottom so it never overflows screen) */}
      <div className="flex items-center justify-between border-t p-4 sm:p-5 shrink-0 bg-gray-50/95 backdrop-blur-xs z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">
            {(bannerConfig.banners || []).length} banner(s) configured
          </span>
          {bannerViewMode === "edit" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBannerViewMode("table")}
              className="text-xs text-gray-700 hover:bg-gray-100 font-semibold"
            >
              <TableIcon className="h-3.5 w-3.5 mr-1 text-amber-600" /> View Banners Table
            </Button>
          )}
        </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={savingBanner}
              onClick={() => setShowBannerModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              loading={savingBanner}
              onClick={handleSaveBanner}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              Save &amp; Publish Banners
            </Button>
          </div>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}

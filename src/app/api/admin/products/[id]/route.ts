import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    const supabase = getSupabaseAdmin();

    // 1. Fetch product
    const { data: product, error: findError } = await supabase
      .from("products")
      .select("id, name, stock")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!product) {
      return NextResponse.json({
        success: true,
        action: "deleted",
        message: "Product already deleted or not found.",
      });
    }

    // 2. Check for historical sales or customer orders
    const { count: posSalesCount } = await supabase
      .from("pos_sale_items")
      .select("*", { count: "exact", head: true })
      .eq("product_id", id);

    const { count: orderItemsCount } = await supabase
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("product_id", id);

    const hasSalesHistory = (posSalesCount ?? 0) > 0 || (orderItemsCount ?? 0) > 0;

    // If it has real sales/orders and force is not specified, deactivate to preserve invoice records
    if (hasSalesHistory && !force) {
      await supabase.from("products").update({ is_active: false }).eq("id", id);
      return NextResponse.json({
        success: true,
        action: "deactivated",
        message: `"${product.name}" has previous sales/order records and was archived (set inactive) to preserve invoice history.`,
      });
    }

    // If force is enabled, clean up sales items
    if (force) {
      await supabase.from("pos_sale_items").delete().eq("product_id", id);
      await supabase.from("order_items").delete().eq("product_id", id);
      await supabase.from("sales_return_items").delete().eq("product_id", id);
      await supabase.from("purchase_return_items").delete().eq("product_id", id);
    }

    // 3. Set temporary high stock so purchase item delete triggers won't raise 'Insufficient stock'
    await supabase.from("products").update({ stock: 999999 }).eq("id", id);

    // 4. Delete purchase items (if any)
    await supabase.from("purchase_items").delete().eq("product_id", id);

    // 5. Delete dependent stock & catalog records
    await supabase.from("cart_items").delete().eq("product_id", id);
    await supabase.from("wishlist").delete().eq("product_id", id);
    await supabase.from("barcode_labels").delete().eq("product_id", id);
    await supabase.from("lot_stock_movements").delete().eq("product_id", id);
    await supabase.from("stock_movements").delete().eq("product_id", id);
    await supabase.from("product_lots").delete().eq("product_id", id);
    await supabase.from("product_variants").delete().eq("product_id", id);

    // 6. Delete the product
    const { error: delError } = await supabase.from("products").delete().eq("id", id);
    if (delError) {
      // If still blocked by an unknown foreign key, fallback to archiving it
      await supabase.from("products").update({ is_active: false }).eq("id", id);
      return NextResponse.json({
        success: true,
        action: "deactivated",
        message: `Product was archived (deactivated) due to database constraints: ${delError.message}`,
      });
    }

    return NextResponse.json({
      success: true,
      action: "deleted",
      message: `Product "${product.name}" permanently deleted.`,
    });
  } catch (err: unknown) {
    console.error("Delete product error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error deleting product" },
      { status: 500 }
    );
  }
}

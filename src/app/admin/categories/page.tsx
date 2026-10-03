"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { categoryService } from "@/services/category.service";
import { categorySchema, type CategoryInput } from "@/lib/validators";
import { slugify } from "@/utils/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types/database";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } =
    useForm<CategoryInput>({ resolver: zodResolver(categorySchema) });

  const load = () => categoryService.getAll().then(setCategories);
  useEffect(() => { load(); }, []);

  const onSubmit = async (data: CategoryInput) => {
    const payload = { ...data, image: data.image || null };
    try {
      if (editing) {
        await categoryService.update(editing.id, payload);
        toast.success("Category updated");
      } else {
        await categoryService.create(payload);
        toast.success("Category created");
      }
      setShowForm(false);
      load();
    } catch {
      toast.error("Failed to save category");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Categories</h1>
        <Button onClick={() => { setEditing(null); reset({ name: "", slug: "" }); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="mb-6 max-w-md space-y-4 rounded-xl border bg-white p-6">
          <Input label="Name" error={errors.name?.message} {...register("name", {
            onChange: (e) => !editing && setValue("slug", slugify(e.target.value)),
          })} />
          <Input label="Slug" error={errors.slug?.message} {...register("slug")} />
          <Input label="Image URL" {...register("image")} />
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b bg-gray-50/80 px-4 py-2.5 text-xs font-semibold text-gray-700 flex items-center justify-between">
          <span>Categories ({categories.length})</span>
          <span className="text-gray-400">Scroll list to review all categories</span>
        </div>
        <div className="max-h-[calc(100vh-280px)] min-h-[250px] overflow-y-auto overscroll-contain scrollbar-thin p-3 space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white p-3 hover:bg-gray-50/80 transition-colors">
              <div>
                <span className="font-semibold text-gray-900">{cat.name}</span>
                <span className="ml-2 font-mono text-xs text-gray-400">/{cat.slug}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded p-1 text-blue-600 hover:bg-blue-50"
                  title="Edit category"
                  onClick={() => {
                    setEditing(cat);
                    reset({ name: cat.name, slug: cat.slug, image: cat.image ?? "" });
                    setShowForm(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  title="Delete category"
                  onClick={async () => {
                    if (confirm("Delete this category?")) {
                      await categoryService.remove(cat.id);
                      load();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">No categories found. Click Add Category to create one.</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
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

      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <span className="font-medium">{cat.name}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => {
                setEditing(cat);
                reset({ name: cat.name, slug: cat.slug, image: cat.image ?? "" });
                setShowForm(true);
              }}>
                <Pencil className="h-4 w-4 text-blue-600" />
              </button>
              <button type="button" onClick={async () => {
                if (confirm("Delete?")) { await categoryService.remove(cat.id); load(); }
              }}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

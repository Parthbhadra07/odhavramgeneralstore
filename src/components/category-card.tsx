import NextImage from "next/image";
import Link from "next/link";
import type { Category } from "@/types/database";
import { cn } from "@/utils/cn";

const PLACEHOLDER = "/images/category-placeholder.svg";

interface CategoryCardProps {
  category: Category;
  className?: string;
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <Link
      href={`/products?category=${category.id}`}
      className={cn(
        "group flex flex-col items-center rounded-xl border border-green-100 bg-white p-4 shadow-sm transition-all hover:border-green-300 hover:shadow-md",
        className
      )}
    >
      <div className="relative mb-3 h-20 w-20 overflow-hidden rounded-full bg-green-50">
        <NextImage
          src={category.image || PLACEHOLDER}
          alt={category.name}
          fill
          className="object-cover transition-transform group-hover:scale-110"
          sizes="80px"
        />
      </div>
      <span className="text-center text-sm font-medium text-gray-800 group-hover:text-green-700">
        {category.name}
      </span>
    </Link>
  );
}

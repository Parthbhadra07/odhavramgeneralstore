import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentProps,
} from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  asChild?: boolean;
  href?: string;
}

const variants = {
  primary: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
  secondary: "bg-emerald-100 text-green-800 hover:bg-emerald-200",
  outline:
    "border-2 border-green-600 text-green-700 hover:bg-green-50 bg-transparent",
  ghost: "text-green-700 hover:bg-green-50 bg-transparent",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      asChild,
      href,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
      variants[variant],
      sizes[size],
      className
    );

    if (href) {
      const { onClick, type: _type, ...linkRest } = props;
      return (
        <Link
          href={href}
          className={classes}
          onClick={onClick}
          {...(linkRest as ComponentProps<typeof Link>)}
        >
          {children}
        </Link>
      );
    }

    if (asChild && typeof children === "object") {
      return <span className={classes}>{children}</span>;
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

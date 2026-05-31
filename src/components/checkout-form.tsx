"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addressSchema, type AddressInput } from "@/lib/validators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CheckoutFormProps {
  onSubmit: (data: AddressInput) => void;
  loading?: boolean;
  defaultValues?: Partial<AddressInput>;
}

export function CheckoutForm({
  onSubmit,
  loading,
  defaultValues,
}: CheckoutFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Address Line"
        id="address_line"
        error={errors.address_line?.message}
        {...register("address_line")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="City"
          id="city"
          error={errors.city?.message}
          {...register("city")}
        />
        <Input
          label="State"
          id="state"
          error={errors.state?.message}
          {...register("state")}
        />
      </div>
      <Input
        label="Postal Code"
        id="postal_code"
        error={errors.postal_code?.message}
        {...register("postal_code")}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("is_default")} className="rounded" />
        Save as default address
      </label>
      <Button type="submit" loading={loading} className="w-full">
        Save Address & Continue
      </Button>
    </form>
  );
}

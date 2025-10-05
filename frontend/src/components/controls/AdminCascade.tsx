"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

export type Option = { value: string; label: string };

export type AdminCascadeLoaders = {
  countries: () => Promise<Option[]>;
  provinces: (country: string) => Promise<Option[]>;
  cities: (country: string, province: string) => Promise<Option[]>;
  villages: (country: string, province: string, city: string) => Promise<Option[]>;
};

export type AdminValue = {
  country?: string;
  state?: string;  // province
  city?: string;
  village?: string;
};

export default function AdminCascade({
  value,
  onChange,
  loaders,
  className = "",
}: {
  value: AdminValue;
  onChange: (v: AdminValue) => void;
  loaders: AdminCascadeLoaders;
  className?: string;
}) {
  const [countries, setCountries] = useState<Option[]>([]);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [villages, setVillages] = useState<Option[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let abort = false;
    (async () => {
      const list = await loaders.countries();
      if (!abort) setCountries(list);
    })();
    return () => { abort = true; };
  }, []);

  useEffect(() => {
    if (!value.country) { setProvinces([]); setCities([]); setVillages([]); return; }
    let abort = false;
    (async () => {
      const list = await loaders.provinces(value.country!);
      if (!abort) setProvinces(list);
    })();
    return () => { abort = true; };
  }, [value.country]);

  useEffect(() => {
    if (!value.country || !value.state) { setCities([]); setVillages([]); return; }
    let abort = false;
    (async () => {
      const list = await loaders.cities(value.country!, value.state!);
      if (!abort) setCities(list);
    })();
    return () => { abort = true; };
  }, [value.country, value.state]);

  useEffect(() => {
    if (!value.country || !value.state || !value.city) { setVillages([]); return; }
    let abort = false;
    (async () => {
      const list = await loaders.villages(value.country!, value.state!, value.city!);
      if (!abort) setVillages(list);
    })();
    return () => { abort = true; };
  }, [value.country, value.state, value.city]);

  function Field({
    label,
    value,
    onChange,
    options,
    disabled,
    placeholder,
  }: {
    label: string;
    value?: string;
    onChange: (v: string | undefined) => void;
    options: Option[];
    disabled?: boolean;
    placeholder: string;
  }) {
    return (
      <div className="space-y-1">
        <div className="text-[11px] text-gray-500">{label}</div>
        <Select
          value={value ?? ""}
          onValueChange={(v) => onChange(v || undefined)}
          disabled={disabled}
        >
          <SelectTrigger
            className="w-full rounded-lg bg-white"
            aria-label={label}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent sideOffset={6} className="rounded-lg">
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div
      className={[
        "pointer-events-auto rounded-xl border bg-white/95 backdrop-blur px-3 py-3 shadow-md",
        "w-[260px] ring-1 ring-black/5 transition-all",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
        className,
      ].join(" ")}
      style={{ animation: mounted ? "pa-fade-in 140ms ease-out" : undefined }}
    >
      <div className="text-sm font-medium mb-2">Administrative Area</div>

      {/* Country */}
      <Field
        label="Country"
        value={value.country}
        onChange={(v) =>
          onChange({ country: v, state: undefined, city: undefined, village: undefined })
        }
        options={countries}
        placeholder="Select Country"
      />

      {/* Province */}
      {(value.country) && (
        <div className="transition-all">
          <Field
            label="Province"
            value={value.state}
            onChange={(v) => onChange({ ...value, state: v, city: undefined, village: undefined })}
            options={provinces}
            disabled={!value.country}
            placeholder="Select Province"
          />
        </div>
      )}

      {/* City */}
      {(value.state) && (
        <div className="transition-all">
          <Field
            label="City"
            value={value.city}
            onChange={(v) => onChange({ ...value, city: v, village: undefined })}
            options={cities}
            disabled={!value.state}
            placeholder="Select City"
          />
        </div>
      )}

      {/* Village */}
      {(value.city) && (
        <div className="transition-all">
          <Field
            label="Village"
            value={value.village}
            onChange={(v) => onChange({ ...value, village: v })}
            options={villages}
            disabled={!value.city}
            placeholder="Select Village"
          />
        </div>
      )}

      <style jsx>{`
        @keyframes pa-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

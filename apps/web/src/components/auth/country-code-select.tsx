"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COUNTRY_CODES = [
  { code: "+91", country: "IN", label: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "+1", country: "US", label: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "+44", country: "GB", label: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "+61", country: "AU", label: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
  { code: "+971", country: "AE", label: "UAE", flag: "\u{1F1E6}\u{1F1EA}" },
  { code: "+65", country: "SG", label: "Singapore", flag: "\u{1F1F8}\u{1F1EC}" },
  { code: "+60", country: "MY", label: "Malaysia", flag: "\u{1F1F2}\u{1F1FE}" },
  { code: "+63", country: "PH", label: "Philippines", flag: "\u{1F1F5}\u{1F1ED}" },
  { code: "+86", country: "CN", label: "China", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "+81", country: "JP", label: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "+82", country: "KR", label: "South Korea", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "+49", country: "DE", label: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "+33", country: "FR", label: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "+39", country: "IT", label: "Italy", flag: "\u{1F1EE}\u{1F1F9}" },
  { code: "+34", country: "ES", label: "Spain", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "+55", country: "BR", label: "Brazil", flag: "\u{1F1E7}\u{1F1F7}" },
  { code: "+27", country: "ZA", label: "South Africa", flag: "\u{1F1FF}\u{1F1E6}" },
  { code: "+966", country: "SA", label: "Saudi Arabia", flag: "\u{1F1F8}\u{1F1E6}" },
  { code: "+974", country: "QA", label: "Qatar", flag: "\u{1F1F6}\u{1F1E6}" },
];

export function CountryCodeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[130px] shrink-0">
        <SelectValue placeholder="+91" />
      </SelectTrigger>
      <SelectContent>
        {COUNTRY_CODES.map((cc) => (
          <SelectItem key={cc.code} value={cc.code}>
            {cc.flag} {cc.code} ({cc.country})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { COUNTRY_CODES };

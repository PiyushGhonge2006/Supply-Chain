import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n";

export function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <Select value={i18n.language} onValueChange={(v) => changeLanguage(v)}>
      <SelectTrigger className="h-8 w-[140px] text-xs gap-1.5 px-2.5">
        <Languages className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code} className="text-xs">
            <span className="flex items-center gap-2">
              <span className="font-medium">{l.native}</span>
              <span className="text-muted-foreground text-[10px]">
                {l.label}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

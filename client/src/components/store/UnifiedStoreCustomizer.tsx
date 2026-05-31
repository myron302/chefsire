import React, { useEffect, useMemo, useState } from "react";
import {
  Upload,
  X,
  Instagram,
  Facebook,
  Twitter,
  Mail,
  Phone,
  MapPin,
  Save,
  RotateCcw,
  Check,
  Star,
  Trophy,
  Users,
  Award,
  Calendar,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { normalizeStoreLayout } from "@shared/store/storeLayout";
import type {
  StoreLayoutCustomizationConfig,
  StoreThemeTokens,
  FontPairingId,
  ButtonShape,
  CornerRadius,
} from "@shared/store/storeLayout";
import { FONT_PAIRINGS } from "@shared/store/storeLayout";
import {
  STORE_THEME_LIST,
  STORE_THEME_PRESETS,
  resolveThemeTokens,
} from "@shared/store/storeThemes";
import StorefrontPreview from "@/components/store/preview/StorefrontPreview";
import type { StoreProduct } from "@/pages/store/StoreViewerContent";
import type { StoreSocialProof } from "@shared/store/storeSocialProof";
import { DEFAULT_SOCIAL_PROOF_VISIBILITY } from "@shared/store/storeSocialProof";

interface UnifiedStoreCustomizerProps {
  store: any;
  products: StoreProduct[];
  onSaved: (updatedStore: any) => void;
  socialProof?: StoreSocialProof;
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center mt-1">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-9 p-0.5 cursor-pointer"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs font-mono"
        />
      </div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  sentinel,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  sentinel?: string;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(value === opt.value ? undefined : opt.value)}
          className={`px-3 py-1.5 border-2 rounded-md text-xs font-medium transition-colors ${
            value === opt.value
              ? "border-orange-500 bg-orange-50 text-orange-700"
              : "border-gray-200 hover:border-gray-300 text-gray-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {sentinel && value !== undefined && (
        <button
          onClick={() => onChange(undefined)}
          className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-md transition-colors"
        >
          {sentinel}
        </button>
      )}
    </div>
  );
}

const ORIGINALS = new Set(["modern", "elegant", "vibrant", "rustic"]);
const ORIGINALS_LIST = STORE_THEME_LIST.filter((t) => ORIGINALS.has(t.id));
const CURATED_LIST = STORE_THEME_LIST.filter((t) => !ORIGINALS.has(t.id));

const FONT_PAIRING_OPTIONS: { value: FontPairingId; label: string }[] = [
  { value: "inter", label: "Inter (Clean Sans)" },
  { value: "editorial", label: "Playfair + Source Sans (Editorial)" },
  { value: "bold-display", label: "Archivo Black + Inter (Bold)" },
  { value: "warm-serif", label: "Lora + Lato (Warm Serif)" },
  { value: "soft-modern", label: "Fraunces + Mulish (Soft Modern)" },
  { value: "refined-serif", label: "Cormorant + Mulish (Refined)" },
];

const BUTTON_SHAPE_OPTIONS: { value: ButtonShape; label: string }[] = [
  { value: "sharp", label: "Sharp" },
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
];

const CORNER_RADIUS_OPTIONS: { value: CornerRadius; label: string }[] = [
  { value: "sharp", label: "Sharp" },
  { value: "soft", label: "Soft" },
  { value: "round", label: "Round" },
];

function makeInitialCustomization(
  saved: StoreLayoutCustomizationConfig,
): StoreLayoutCustomizationConfig {
  return {
    logo: saved?.logo || "",
    bannerImage: saved?.bannerImage || "",
    bannerTitle: saved?.bannerTitle || "",
    bannerSubtitle: saved?.bannerSubtitle || "",
    showBanner: saved?.showBanner !== false,
    aboutEnabled: saved?.aboutEnabled || false,
    aboutTitle: saved?.aboutTitle || "About Us",
    aboutContent: saved?.aboutContent || "",
    announcementBar: saved?.announcementBar || "",
    announcementEnabled: saved?.announcementEnabled || false,
    socialLinks: saved?.socialLinks || {
      instagram: "",
      facebook: "",
      twitter: "",
      email: "",
      phone: "",
    },
    contactInfo: saved?.contactInfo || { address: "", hours: "" },
    layout: saved?.layout || { gridColumns: 3, productCardStyle: "elevated", spacing: "normal" },
    tokens: saved?.tokens,
  };
}

export default function UnifiedStoreCustomizer({ store, products, onSaved, socialProof }: UnifiedStoreCustomizerProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const savedCustomization = useMemo(
    () => normalizeStoreLayout(store?.layout).customization,
    [store?.layout],
  );

  const [draftName, setDraftName] = useState(store?.name || "");
  const [draftBio, setDraftBio] = useState(store?.bio || "");
  const [draftTheme, setDraftTheme] = useState(store?.theme || "modern");
  const [draftCustomization, setDraftCustomization] = useState<StoreLayoutCustomizationConfig>(
    () => makeInitialCustomization(savedCustomization),
  );

  const isDirty = useMemo(() => {
    if (draftName !== (store?.name || "")) return true;
    if (draftBio !== (store?.bio || "")) return true;
    if (draftTheme !== (store?.theme || "modern")) return true;
    return (
      JSON.stringify(draftCustomization) !==
      JSON.stringify(makeInitialCustomization(savedCustomization))
    );
  }, [draftName, draftBio, draftTheme, draftCustomization, store, savedCustomization]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const patchCustomization = (patch: Partial<StoreLayoutCustomizationConfig>) =>
    setDraftCustomization((prev) => ({ ...prev, ...patch }));

  const patchToken = (key: keyof StoreThemeTokens, value: string | undefined) =>
    setDraftCustomization((prev) => {
      const tokens = { ...(prev.tokens ?? {}) };
      if (value === undefined) {
        delete (tokens as any)[key];
      } else {
        (tokens as any)[key] = value;
      }
      return { ...prev, tokens: Object.keys(tokens).length ? tokens : {} };
    });

  const handleDiscard = () => {
    if (!isDirty) return;
    if (!window.confirm("Discard all unsaved changes?")) return;
    setDraftName(store?.name || "");
    setDraftBio(store?.bio || "");
    setDraftTheme(store?.theme || "modern");
    setDraftCustomization(makeInitialCustomization(savedCustomization));
  };

  const handleSave = async () => {
    if (!store?.id) return;
    setSaving(true);
    try {
      // Strip legacy `colors` on save — all color overrides now live in `tokens`
      const { colors: _legacy, ...customizationToSave } = draftCustomization;
      const res = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: draftName.trim() || store.name,
          bio: draftBio.trim() || null,
          theme: draftTheme,
          customization: customizationToSave,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ description: "Store saved!" });
        onSaved(data.store);
      } else {
        const err = await res.json();
        toast({
          title: "Save failed",
          description: err.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Save failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo" | "bannerImage",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        patchCustomization({ [field]: data.url });
        toast({ description: "Image uploaded!" });
      } else {
        toast({ title: "Upload failed", description: "Failed to upload image.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const c = draftCustomization;
  const presetTokens = STORE_THEME_PRESETS[draftTheme] ?? STORE_THEME_PRESETS.modern;

  // Effective value for a color token: override if set, else preset
  const colorVal = (key: "primary" | "secondary" | "accent" | "surface" | "text") =>
    (c.tokens as any)?.[key] ?? presetTokens[key];

  const fontPairingVal = c.tokens?.fontPairing;
  const buttonShapeVal = c.tokens?.buttonShape;
  const cornerRadiusVal = c.tokens?.cornerRadius;

  function ThemeCard({ id, name }: { id: string; name: string }) {
    const preset = STORE_THEME_PRESETS[id];
    const selected = draftTheme === id;
    return (
      <button
        onClick={() => setDraftTheme(id)}
        className={`relative rounded-lg border-2 overflow-hidden transition-all text-left w-full ${
          selected ? "border-orange-500 shadow-md" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <div
          className="h-10"
          style={{
            background: `linear-gradient(135deg, ${preset.primary} 0%, ${preset.secondary} 100%)`,
          }}
        >
          {selected && (
            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5 z-10">
              <Check size={9} className="text-white" />
            </div>
          )}
        </div>
        <div className="px-1.5 py-1" style={{ backgroundColor: preset.surface }}>
          <p
            className="text-[10px] font-semibold leading-tight truncate"
            style={{ color: preset.text }}
          >
            {name}
          </p>
          <div className="flex gap-0.5 mt-0.5">
            {[preset.primary, preset.secondary, preset.accent].map((col) => (
              <div
                key={col}
                className="w-2.5 h-2.5 rounded-full border border-black/10"
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px]">
      {/* ── Left control panel ── */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r bg-white overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <Accordion type="multiple" defaultValue={["theme", "branding"]} className="space-y-1">

            {/* 1. Theme — 16 cards in two labeled groups */}
            <AccordionItem value="theme" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Theme</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5 font-semibold">
                    Originals
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ORIGINALS_LIST.map((t) => (
                      <ThemeCard key={t.id} id={t.id} name={t.name} />
                    ))}
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5 font-semibold">
                    Curated
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {CURATED_LIST.map((t) => (
                      <ThemeCard key={t.id} id={t.id} name={t.name} />
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Branding */}
            <AccordionItem value="branding" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Branding</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                <div>
                  <Label className="text-xs">Store Name</Label>
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="mt-1 text-sm"
                    placeholder="Your store name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bio / Description</Label>
                  <Textarea
                    value={draftBio}
                    onChange={(e) => setDraftBio(e.target.value)}
                    rows={3}
                    className="mt-1 text-sm resize-none"
                    placeholder="Tell shoppers what your store is about…"
                  />
                </div>
                <div>
                  <Label className="text-xs">Logo</Label>
                  {c.logo ? (
                    <div className="relative inline-block mt-1">
                      <img
                        src={c.logo}
                        alt="Logo"
                        className="h-20 w-20 object-contain border rounded-lg"
                      />
                      <button
                        onClick={() => patchCustomization({ logo: "" })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="mt-1 flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500">Upload logo</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "logo")}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Trust Signals */}
            <AccordionItem value="trust" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Trust Signals</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <p className="text-xs text-gray-500">
                  Show your ChefSire credentials on your storefront to build buyer trust.
                </p>
                {[
                  {
                    key: "showReviewRating" as const,
                    icon: <Star className="w-3.5 h-3.5" />,
                    label: "Review Rating",
                    available: !!(socialProof?.reviewRating && socialProof.reviewRating.count > 0),
                    missingNote: "Earn your first store review to enable this.",
                  },
                  {
                    key: "showCookoffWins" as const,
                    icon: <Trophy className="w-3.5 h-3.5" />,
                    label: "Cook-off Wins",
                    available: typeof socialProof?.cookoffWins === "number",
                    missingNote: "Win a cook-off competition to enable this.",
                  },
                  {
                    key: "showFollowerCount" as const,
                    icon: <Users className="w-3.5 h-3.5" />,
                    label: "Followers",
                    available: typeof socialProof?.followerCount === "number",
                    missingNote: "Follower data unavailable.",
                  },
                  {
                    key: "showChefClubs" as const,
                    icon: <Award className="w-3.5 h-3.5" />,
                    label: "Chef Clubs",
                    available: !!(socialProof?.chefClubs && socialProof.chefClubs.length > 0),
                    missingNote: "Join a chef club to enable this.",
                  },
                  {
                    key: "showMemberSince" as const,
                    icon: <Calendar className="w-3.5 h-3.5" />,
                    label: "Member Since",
                    available: !!socialProof?.memberSince,
                    missingNote: "Account date unavailable.",
                  },
                ].map(({ key, icon, label, available, missingNote }) => {
                  const checked =
                    c.socialProof?.[key] ??
                    DEFAULT_SOCIAL_PROOF_VISIBILITY[key];
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between gap-2">
                        <label
                          className={`flex items-center gap-1.5 text-xs ${available ? "text-gray-700" : "text-gray-400"}`}
                        >
                          {icon}
                          {label}
                        </label>
                        <Switch
                          checked={available ? checked : false}
                          disabled={!available}
                          onCheckedChange={(v) =>
                            patchCustomization({
                              socialProof: { ...c.socialProof, [key]: v },
                            })
                          }
                        />
                      </div>
                      {!available && (
                        <p className="text-[10px] text-gray-400 mt-0.5 pl-5">{missingNote}</p>
                      )}
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>

            {/* 4. Colors — 5 per-channel token pickers */}
            <AccordionItem value="colors" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Colors</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <p className="text-xs text-gray-500">
                  Override individual colors. Others continue tracking the theme preset.
                </p>
                <ColorPicker
                  label="Primary"
                  value={colorVal("primary")}
                  onChange={(v) => patchToken("primary", v)}
                />
                <ColorPicker
                  label="Secondary"
                  value={colorVal("secondary")}
                  onChange={(v) => patchToken("secondary", v)}
                />
                <ColorPicker
                  label="Accent"
                  value={colorVal("accent")}
                  onChange={(v) => patchToken("accent", v)}
                />
                <ColorPicker
                  label="Surface (background)"
                  value={colorVal("surface")}
                  onChange={(v) => patchToken("surface", v)}
                />
                <ColorPicker
                  label="Text"
                  value={colorVal("text")}
                  onChange={(v) => patchToken("text", v)}
                />
                {c.tokens &&
                  Object.keys(c.tokens).some((k) =>
                    ["primary", "secondary", "accent", "surface", "text"].includes(k),
                  ) && (
                    <button
                      onClick={() => {
                        const { primary: _p, secondary: _s, accent: _a, surface: _su, text: _t, ...rest } =
                          c.tokens ?? {};
                        patchCustomization({ tokens: Object.keys(rest).length ? rest : {} });
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Reset colors to theme default
                    </button>
                  )}
              </AccordionContent>
            </AccordionItem>

            {/* 5. Typography */}
            <AccordionItem value="typography" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Typography</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <div>
                  <Label className="text-xs">Font Pairing</Label>
                  <select
                    value={fontPairingVal ?? ""}
                    onChange={(e) => patchToken("fontPairing", e.target.value || undefined)}
                    className="mt-1 w-full text-xs border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Use theme default ({presetTokens.fontPairing})</option>
                    {FONT_PAIRING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="border rounded-lg p-3 bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-400 mb-1">Preview</p>
                  <p
                    className="font-bold text-sm"
                    style={{
                      fontFamily:
                        FONT_PAIRINGS[fontPairingVal ?? presetTokens.fontPairing]?.heading,
                    }}
                  >
                    The quick brown fox
                  </p>
                  <p
                    className="text-xs"
                    style={{
                      fontFamily:
                        FONT_PAIRINGS[fontPairingVal ?? presetTokens.fontPairing]?.body,
                    }}
                  >
                    Handcrafted with love — body text appears in this typeface.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 6. Button Style */}
            <AccordionItem value="buttonShape" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Button Style</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <SegmentedControl
                  options={BUTTON_SHAPE_OPTIONS}
                  value={buttonShapeVal}
                  onChange={(v) => patchToken("buttonShape", v)}
                  sentinel="Use theme default"
                />
                <div className="flex gap-2 mt-2">
                  {BUTTON_SHAPE_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      className={`px-4 py-1.5 text-xs border-2 border-orange-400 text-orange-600 font-medium transition-opacity ${
                        (buttonShapeVal ?? presetTokens.buttonShape) === opt.value
                          ? "opacity-100"
                          : "opacity-30"
                      }`}
                      style={{
                        borderRadius:
                          opt.value === "sharp" ? "0px" : opt.value === "pill" ? "9999px" : "8px",
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 7. Corner Radius */}
            <AccordionItem value="cornerRadius" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Corner Radius</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <SegmentedControl
                  options={CORNER_RADIUS_OPTIONS}
                  value={cornerRadiusVal}
                  onChange={(v) => patchToken("cornerRadius", v)}
                  sentinel="Use theme default"
                />
                <div className="flex gap-2 mt-2">
                  {CORNER_RADIUS_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      className={`w-10 h-10 bg-orange-400 transition-opacity ${
                        (cornerRadiusVal ?? presetTokens.cornerRadius) === opt.value
                          ? "opacity-100"
                          : "opacity-30"
                      }`}
                      style={{
                        borderRadius:
                          opt.value === "sharp" ? "0px" : opt.value === "round" ? "16px" : "8px",
                      }}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 8. Hero / Banner */}
            <AccordionItem value="banner" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">
                <span className="flex items-center gap-2">
                  Hero / Banner
                  <Switch
                    checked={c.showBanner !== false}
                    onCheckedChange={(v) => patchCustomization({ showBanner: v })}
                    onClick={(e) => e.stopPropagation()}
                    className="scale-75"
                  />
                </span>
              </AccordionTrigger>
              {c.showBanner !== false && (
                <AccordionContent className="pb-4 space-y-3">
                  {c.bannerImage ? (
                    <div className="relative">
                      <img
                        src={c.bannerImage}
                        alt="Banner"
                        className="w-full h-28 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => patchCustomization({ bannerImage: "" })}
                        className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500">Upload banner (1200×400px)</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "bannerImage")}
                        disabled={uploading}
                      />
                    </label>
                  )}
                  <div>
                    <Label className="text-xs">Banner Title</Label>
                    <Input
                      value={c.bannerTitle || ""}
                      onChange={(e) => patchCustomization({ bannerTitle: e.target.value })}
                      placeholder="Welcome to our store!"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Banner Subtitle</Label>
                    <Input
                      value={c.bannerSubtitle || ""}
                      onChange={(e) => patchCustomization({ bannerSubtitle: e.target.value })}
                      placeholder="Discover amazing products"
                      className="mt-1 text-sm"
                    />
                  </div>
                </AccordionContent>
              )}
            </AccordionItem>

            {/* 9. About */}
            <AccordionItem value="about" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">
                <span className="flex items-center gap-2">
                  About
                  <Switch
                    checked={c.aboutEnabled || false}
                    onCheckedChange={(v) => patchCustomization({ aboutEnabled: v })}
                    onClick={(e) => e.stopPropagation()}
                    className="scale-75"
                  />
                </span>
              </AccordionTrigger>
              {c.aboutEnabled && (
                <AccordionContent className="pb-4 space-y-3">
                  <div>
                    <Label className="text-xs">Section Title</Label>
                    <Input
                      value={c.aboutTitle || "About Us"}
                      onChange={(e) => patchCustomization({ aboutTitle: e.target.value })}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Content</Label>
                    <Textarea
                      value={c.aboutContent || ""}
                      onChange={(e) => patchCustomization({ aboutContent: e.target.value })}
                      rows={4}
                      className="mt-1 text-sm resize-none"
                      placeholder="Tell your story…"
                    />
                  </div>
                </AccordionContent>
              )}
            </AccordionItem>

            {/* 10. Announcement Bar */}
            <AccordionItem value="announcement" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">
                <span className="flex items-center gap-2">
                  Announcement Bar
                  <Switch
                    checked={c.announcementEnabled || false}
                    onCheckedChange={(v) => patchCustomization({ announcementEnabled: v })}
                    onClick={(e) => e.stopPropagation()}
                    className="scale-75"
                  />
                </span>
              </AccordionTrigger>
              {c.announcementEnabled && (
                <AccordionContent className="pb-4">
                  <Input
                    value={c.announcementBar || ""}
                    onChange={(e) => patchCustomization({ announcementBar: e.target.value })}
                    placeholder="e.g., Free shipping on orders over $50!"
                    className="text-sm"
                  />
                </AccordionContent>
              )}
            </AccordionItem>

            {/* 11. Layout */}
            <AccordionItem value="layout" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Layout</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                <div>
                  <Label className="text-xs">Grid Columns</Label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                    {[2, 3, 4, 5].map((cols) => (
                      <button
                        key={cols}
                        onClick={() =>
                          patchCustomization({ layout: { ...c.layout, gridColumns: cols } })
                        }
                        className={`py-2 border-2 rounded-lg text-center text-xs font-semibold transition-colors ${
                          c.layout?.gridColumns === cols
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {cols}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Card Style</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {[
                      { value: "elevated", label: "Elevated", desc: "With shadow" },
                      { value: "flat", label: "Flat", desc: "Simple border" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          patchCustomization({
                            layout: { ...c.layout, productCardStyle: opt.value as any },
                          })
                        }
                        className={`p-3 border-2 rounded-lg transition-colors text-left ${
                          c.layout?.productCardStyle === opt.value
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className="text-xs font-semibold">{opt.label}</p>
                        <p className="text-[10px] text-gray-500">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Spacing</Label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                    {["compact", "normal", "relaxed"].map((sp) => (
                      <button
                        key={sp}
                        onClick={() =>
                          patchCustomization({ layout: { ...c.layout, spacing: sp as any } })
                        }
                        className={`py-2 border-2 rounded-lg text-center text-xs font-medium capitalize transition-colors ${
                          c.layout?.spacing === sp
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 12. Contact & Social */}
            <AccordionItem value="contact" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Contact & Social</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                {[
                  { key: "phone", icon: <Phone size={13} />, label: "Phone", placeholder: "(555) 123-4567", type: "tel" },
                  { key: "email", icon: <Mail size={13} />, label: "Email", placeholder: "contact@yourstore.com", type: "email" },
                  { key: "instagram", icon: <Instagram size={13} />, label: "Instagram", placeholder: "https://instagram.com/yourstore" },
                  { key: "facebook", icon: <Facebook size={13} />, label: "Facebook", placeholder: "https://facebook.com/yourstore" },
                  { key: "twitter", icon: <Twitter size={13} />, label: "Twitter", placeholder: "https://twitter.com/yourstore" },
                ].map(({ key, icon, label, placeholder, type }) => (
                  <div key={key}>
                    <Label className="flex items-center gap-1.5 text-xs">
                      {icon} {label}
                    </Label>
                    <Input
                      type={type || "text"}
                      value={(c.socialLinks as any)?.[key] || ""}
                      onChange={(e) =>
                        patchCustomization({
                          socialLinks: { ...c.socialLinks, [key]: e.target.value },
                        })
                      }
                      placeholder={placeholder}
                      className="mt-1 text-xs"
                    />
                  </div>
                ))}
                <div>
                  <Label className="flex items-center gap-1.5 text-xs">
                    <MapPin size={13} /> Address
                  </Label>
                  <Textarea
                    value={c.contactInfo?.address || ""}
                    onChange={(e) =>
                      patchCustomization({
                        contactInfo: { ...c.contactInfo, address: e.target.value },
                      })
                    }
                    rows={2}
                    className="mt-1 text-xs resize-none"
                    placeholder="123 Main St, City, State"
                  />
                </div>
                <div>
                  <Label className="text-xs">Store Hours</Label>
                  <Textarea
                    value={c.contactInfo?.hours || ""}
                    onChange={(e) =>
                      patchCustomization({
                        contactInfo: { ...c.contactInfo, hours: e.target.value },
                      })
                    }
                    rows={2}
                    className="mt-1 text-xs resize-none"
                    placeholder={"Mon–Fri: 9am–6pm\nSat–Sun: 10am–4pm"}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 border-t bg-white px-4 py-3 flex items-center gap-2">
          {isDirty ? (
            <span className="text-xs text-amber-600 font-medium flex-1">Unsaved changes</span>
          ) : (
            <span className="flex-1 text-xs text-gray-400">All changes saved</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={!isDirty || saving}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Right preview pane ── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <StorefrontPreview
          store={store}
          draftName={draftName}
          draftBio={draftBio}
          draftTheme={draftTheme}
          draftCustomization={draftCustomization}
          products={products}
        />
      </div>
    </div>
  );
}

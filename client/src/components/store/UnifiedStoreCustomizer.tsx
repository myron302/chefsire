import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeStoreLayout } from "@shared/store/storeLayout";
import type { StoreLayoutCustomizationConfig } from "@shared/store/storeLayout";
import { THEMES } from "@/components/store/ThemeSelector";
import StorefrontPreview from "@/components/store/preview/StorefrontPreview";
import type { StoreProduct } from "@/pages/store/StoreViewerContent";

interface UnifiedStoreCustomizerProps {
  store: any;
  products: StoreProduct[];
  onSaved: (updatedStore: any) => void;
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
        <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-12 h-9 p-0.5 cursor-pointer" />
        <Input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 text-xs font-mono" />
      </div>
    </div>
  );
}

export default function UnifiedStoreCustomizer({
  store,
  products,
  onSaved,
}: UnifiedStoreCustomizerProps) {
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
  const [draftCustomization, setDraftCustomization] = useState<StoreLayoutCustomizationConfig>({
    logo: savedCustomization?.logo || "",
    bannerImage: savedCustomization?.bannerImage || "",
    bannerTitle: savedCustomization?.bannerTitle || "",
    bannerSubtitle: savedCustomization?.bannerSubtitle || "",
    showBanner: savedCustomization?.showBanner !== false,
    aboutEnabled: savedCustomization?.aboutEnabled || false,
    aboutTitle: savedCustomization?.aboutTitle || "About Us",
    aboutContent: savedCustomization?.aboutContent || "",
    announcementBar: savedCustomization?.announcementBar || "",
    announcementEnabled: savedCustomization?.announcementEnabled || false,
    socialLinks: savedCustomization?.socialLinks || {
      instagram: "",
      facebook: "",
      twitter: "",
      email: "",
      phone: "",
    },
    contactInfo: savedCustomization?.contactInfo || { address: "", hours: "" },
    layout: savedCustomization?.layout || {
      gridColumns: 3,
      productCardStyle: "elevated",
      spacing: "normal",
    },
    colors: savedCustomization?.colors || {
      primary: "#FF6B35",
      secondary: "#2C3E50",
      accent: "#F7F7F7",
    },
  });

  const isDirty = useMemo(() => {
    if (draftName !== (store?.name || "")) return true;
    if (draftBio !== (store?.bio || "")) return true;
    if (draftTheme !== (store?.theme || "modern")) return true;
    return JSON.stringify(draftCustomization) !== JSON.stringify(savedCustomization);
  }, [draftName, draftBio, draftTheme, draftCustomization, store, savedCustomization]);

  // Warn on navigation away with unsaved changes
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

  const handleDiscard = () => {
    if (!isDirty) return;
    if (!window.confirm("Discard all unsaved changes?")) return;
    setDraftName(store?.name || "");
    setDraftBio(store?.bio || "");
    setDraftTheme(store?.theme || "modern");
    setDraftCustomization({
      logo: savedCustomization?.logo || "",
      bannerImage: savedCustomization?.bannerImage || "",
      bannerTitle: savedCustomization?.bannerTitle || "",
      bannerSubtitle: savedCustomization?.bannerSubtitle || "",
      showBanner: savedCustomization?.showBanner !== false,
      aboutEnabled: savedCustomization?.aboutEnabled || false,
      aboutTitle: savedCustomization?.aboutTitle || "About Us",
      aboutContent: savedCustomization?.aboutContent || "",
      announcementBar: savedCustomization?.announcementBar || "",
      announcementEnabled: savedCustomization?.announcementEnabled || false,
      socialLinks: savedCustomization?.socialLinks || {
        instagram: "",
        facebook: "",
        twitter: "",
        email: "",
        phone: "",
      },
      contactInfo: savedCustomization?.contactInfo || { address: "", hours: "" },
      layout: savedCustomization?.layout || {
        gridColumns: 3,
        productCardStyle: "elevated",
        spacing: "normal",
      },
      colors: savedCustomization?.colors || {
        primary: "#FF6B35",
        secondary: "#2C3E50",
        accent: "#F7F7F7",
      },
    });
  };

  const handleSave = async () => {
    if (!store?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: draftName.trim() || store.name,
          bio: draftBio.trim() || null,
          theme: draftTheme,
          customization: draftCustomization,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ description: "Store saved!" });
        onSaved(data.store);
      } else {
        const err = await res.json();
        toast({ title: "Save failed", description: err.error || "Please try again.", variant: "destructive" });
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
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
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

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px]">
      {/* ── Left control panel ── */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r bg-white overflow-hidden">
        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <Accordion type="multiple" defaultValue={["theme", "branding"]} className="space-y-1">

            {/* 1. Theme */}
            <AccordionItem value="theme" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Theme</AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-2 gap-3">
                  {THEMES.map((theme) => {
                    const selected = draftTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => setDraftTheme(theme.id)}
                        className={`relative rounded-lg border-2 overflow-hidden transition-all text-left ${
                          selected ? "border-orange-500 shadow-md" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className="h-14"
                          style={{
                            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
                          }}
                        >
                          {selected && (
                            <div className="absolute top-1.5 right-1.5 bg-green-500 rounded-full p-0.5">
                              <Check size={10} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-semibold leading-tight">{theme.name}</p>
                          <div className="flex gap-1 mt-1">
                            {[theme.colors.primary, theme.colors.secondary, theme.colors.accent].map(
                              (col) => (
                                <div
                                  key={col}
                                  className="w-3 h-3 rounded-full border border-gray-200"
                                  style={{ backgroundColor: col }}
                                />
                              ),
                            )}
                          </div>
                        </div>
                        {selected && (
                          <Badge className="absolute bottom-1.5 right-1.5 text-[9px] px-1.5 py-0 bg-orange-500">
                            Selected
                          </Badge>
                        )}
                      </button>
                    );
                  })}
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
                      <img src={c.logo} alt="Logo" className="h-20 w-20 object-contain border rounded-lg" />
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

            {/* 3. Colors */}
            <AccordionItem value="colors" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold py-3">Colors</AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <p className="text-xs text-gray-500">Override the theme preset with your brand colors.</p>
                <ColorPicker
                  label="Primary"
                  value={c.colors?.primary || "#FF6B35"}
                  onChange={(v) => patchCustomization({ colors: { ...c.colors, primary: v } })}
                />
                <ColorPicker
                  label="Secondary"
                  value={c.colors?.secondary || "#2C3E50"}
                  onChange={(v) => patchCustomization({ colors: { ...c.colors, secondary: v } })}
                />
                <ColorPicker
                  label="Accent / Background"
                  value={c.colors?.accent || "#F7F7F7"}
                  onChange={(v) => patchCustomization({ colors: { ...c.colors, accent: v } })}
                />
              </AccordionContent>
            </AccordionItem>

            {/* 4. Hero / Banner */}
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
                      <img src={c.bannerImage} alt="Banner" className="w-full h-28 object-cover rounded-lg" />
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

            {/* 5. About */}
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

            {/* 6. Announcement Bar */}
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

            {/* 7. Layout */}
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

            {/* 8. Contact & Social */}
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
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium flex-1">Unsaved changes</span>
          )}
          {!isDirty && <span className="flex-1 text-xs text-gray-400">All changes saved</span>}
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

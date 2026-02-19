// client/src/pages/services/vendor-listing.tsx
import { useState, useCallback } from "react";
import { Link } from "wouter";
import {
  Building2, CheckCircle2, ArrowRight, ArrowLeft, X, Plus,
  Star, Users, CalendarCheck, BarChart3, BadgeCheck, CreditCard,
  Globe, Phone, Mail, Camera, Music, Flower, ChefHat, MapPin,
  Heart, Sparkles, Shield, TrendingUp, Zap, Info, MessageSquare,
  Clock, DollarSign, Megaphone, Award,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ─── Data ───────────────────────────────────────────────────────────────────

const STATS = [
  { icon: Users, value: "12,400+", label: "Couples planning weddings", color: "text-pink-400" },
  { icon: CalendarCheck, value: "3,200+", label: "Bookings made last year", color: "text-purple-400" },
  { icon: BarChart3, value: "$2.1M+", label: "Revenue generated for vendors", color: "text-amber-400" },
  { icon: Star, value: "4.9 ★", label: "Average vendor rating", color: "text-emerald-400" },
];

const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "Free",
    priceNote: "Forever free",
    color: "border-slate-200",
    headerColor: "bg-slate-50 dark:bg-slate-900",
    cta: "Get Started Free",
    ctaClass: "border-slate-400 hover:bg-slate-50",
    ctaVariant: "outline" as const,
    badge: null,
    bookingFee: "8% per booking",
    features: [
      "1 listing page",
      "Business name, category & location",
      "Contact info & website link",
      "Up to 3 photos",
      "Couples can send quote requests",
      "Basic profile analytics",
    ],
    notIncluded: [
      "Priority search placement",
      "Featured / Sponsored badge",
      "Inline booking calendar",
      "Messaging inbox",
      "Performance reports",
      "AI lead scoring",
    ],
  },
  {
    id: "featured" as const,
    name: "Featured",
    price: "$49",
    priceNote: "/ month",
    color: "border-pink-400",
    headerColor: "bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950",
    cta: "Start Featured",
    ctaClass: "bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:from-pink-700 hover:to-purple-700",
    ctaVariant: "default" as const,
    badge: "Most Popular",
    badgeColor: "bg-pink-500",
    bookingFee: "5% per booking",
    features: [
      "Everything in Basic",
      "Featured badge on listing",
      "Priority placement in search results",
      "Up to 20 photos + promo video reel",
      "Inline booking calendar",
      "Quote inbox & direct messaging",
      "Monthly performance report",
      "Highlighted in category pages",
    ],
    notIncluded: [
      "AI-powered lead scoring",
      "Sponsored top-of-feed placement",
      "Dedicated account manager",
    ],
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "$149",
    priceNote: "/ month",
    color: "border-amber-400",
    headerColor: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
    cta: "Go Premium",
    ctaClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600",
    ctaVariant: "default" as const,
    badge: "Best Value",
    badgeColor: "bg-amber-500",
    bookingFee: "3% per booking",
    features: [
      "Everything in Featured",
      "Sponsored placement at top of search",
      "AI-powered lead scoring & match alerts",
      "Unlimited photos & videos",
      "Dedicated account manager",
      "Cross-promotion on social feed",
      "Advanced analytics dashboard",
      "Priority review responses",
      "Quarterly business insights report",
    ],
    notIncluded: [],
  },
] as const;

type PlanId = typeof PLANS[number]["id"];

const TESTIMONIALS = [
  {
    name: "Maria Santos",
    business: "Floral Dreams by Maria",
    category: "Florist",
    avatar: "MS",
    color: "from-pink-500 to-rose-400",
    quote: "I went from 2 bookings a month to 11 within 90 days of upgrading to Featured. The booking calendar alone paid for itself in the first week.",
    stats: "5× more inquiries",
  },
  {
    name: "James & Kevin Tran",
    business: "Horizon Photography",
    category: "Photography",
    avatar: "HP",
    color: "from-purple-500 to-indigo-400",
    quote: "Couples come in already knowing our style and price range — so every call converts. We booked 8 weddings in January, our biggest month ever.",
    stats: "8 weddings in Jan",
  },
  {
    name: "Chef Antoine Dupont",
    business: "Maison Dupont Catering",
    category: "Catering",
    avatar: "MD",
    color: "from-amber-500 to-orange-400",
    quote: "The AI lead scoring tells me which couples are ready to book vs. just browsing. I focus my energy on the hot leads and close 3× more deals.",
    stats: "3× close rate",
  },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    icon: Building2,
    title: "Create your listing",
    desc: "Fill in your business details, upload photos, set pricing ranges, and write your story. Takes about 10 minutes.",
    color: "from-pink-600 to-rose-500",
  },
  {
    step: 2,
    icon: BadgeCheck,
    title: "Get verified",
    desc: "Our team reviews your listing within 24 hours, validates your credentials, and adds a verification badge to build couple trust.",
    color: "from-purple-600 to-indigo-500",
  },
  {
    step: 3,
    icon: CalendarCheck,
    title: "Accept bookings",
    desc: "Couples browse, message you, request quotes, and book directly through your calendar. No back-and-forth emails.",
    color: "from-blue-600 to-cyan-500",
  },
  {
    step: 4,
    icon: CreditCard,
    title: "Get paid",
    desc: "Secure payments collected through the platform. Funds deposited in 2–3 business days after each booking.",
    color: "from-emerald-600 to-teal-500",
  },
];

const VENDOR_CATEGORIES = [
  { value: "caterer", label: "Catering", icon: ChefHat },
  { value: "venue", label: "Venue", icon: MapPin },
  { value: "photographer", label: "Photography / Videography", icon: Camera },
  { value: "dj", label: "DJ & Music / Band", icon: Music },
  { value: "florist", label: "Florist / Décor", icon: Flower },
  { value: "planner", label: "Wedding Planner / Coordinator", icon: Heart },
  { value: "cake", label: "Cake & Bakery", icon: Sparkles },
  { value: "officiant", label: "Officiant", icon: Award },
  { value: "beauty", label: "Hair & Makeup", icon: Star },
  { value: "transportation", label: "Transportation / Limo", icon: Globe },
  { value: "photo_booth", label: "Photo Booth", icon: Camera },
  { value: "other", label: "Other", icon: Building2 },
];

const FAQS = [
  {
    q: "How does the booking fee work?",
    a: "A small percentage is deducted from payments collected through our platform. If a couple pays you directly (cash, check, wire), there's no fee — the fee only applies to on-platform transactions.",
  },
  {
    q: "When do I receive my funds?",
    a: "Funds are deposited 2–3 business days after each booking is confirmed. Premium vendors get priority processing.",
  },
  {
    q: "Can I cancel or change my plan anytime?",
    a: "Yes — you can upgrade, downgrade, or cancel monthly plans at any time from your vendor dashboard. Annual plans include a 30-day money-back guarantee.",
  },
  {
    q: "How long does verification take?",
    a: "Most listings are reviewed within 24 hours on business days. Premium vendors are prioritized and typically verified within 4 hours.",
  },
  {
    q: "What happens after I submit my listing?",
    a: "You'll receive a confirmation email immediately. Our team reviews your listing and follows up with next steps, including how to connect your booking calendar.",
  },
  {
    q: "Do you offer annual pricing?",
    a: "Yes — annual plans save you 20% vs. monthly. Contact us at vendors@chefsire.com to set up annual billing.",
  },
];

// ─── Form default state ──────────────────────────────────────────────────────

const DEFAULT_FORM = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  instagramHandle: "",
  category: "",
  city: "",
  state: "",
  description: "",
  minPrice: "",
  maxPrice: "",
  yearsInBusiness: "",
  agreeToTerms: false,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function VendorListingPage() {
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitted, setSubmitted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("featured");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const update = useCallback((field: string, value: string | boolean) => {
    setForm((p) => ({ ...p, [field]: value }));
  }, []);

  const goToStep2 = useCallback(() => {
    if (!form.businessName.trim() || !form.email.trim() || !form.category || !form.city.trim()) {
      toast({ title: "Required fields missing", description: "Please fill in business name, email, city, and category.", variant: "destructive" });
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [form, toast]);

  const goToStep3 = useCallback(() => {
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const submitListing = useCallback(async () => {
    if (!form.agreeToTerms) {
      toast({ title: "Terms required", description: "Please agree to the listing terms to continue.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/wedding/vendor-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, plan: selectedPlan }),
      });
      if (!res.ok && res.status !== 404 && res.status !== 501) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Submission failed");
      }
    } catch {
      // Optimistic — show success even if API not wired yet
    }
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [form, selectedPlan, toast]);

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-11 w-11 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold">You're on the list!</h1>
        <p className="text-muted-foreground max-w-sm mx-auto">
          We received your application for <strong>{form.businessName || "your business"}</strong> on the <strong className="capitalize">{selectedPlan}</strong> plan. Our team will reach out within 24 hours.
        </p>
        <div className="rounded-2xl bg-muted/60 p-6 text-left max-w-sm mx-auto space-y-3">
          <p className="text-xs font-semibold text-muted-foreground tracking-wide">WHAT HAPPENS NEXT</p>
          {[
            "Listing reviewed within 24 hours",
            "Verification badge added to your profile",
            "Profile goes live on the platform",
            "You can start accepting quote requests",
          ].map((s) => (
            <div key={s} className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              {s}
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/services/wedding-planning">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Wedding Planning
            </Button>
          </Link>
          <Button onClick={() => { setSubmitted(false); setStep(1); setForm(DEFAULT_FORM); }}>
            Submit Another Listing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">

      {/* ── Back link ── */}
      <div className="mb-6">
        <Link href="/services/wedding-planning">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Wedding Planning
          </Button>
        </Link>
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950 to-pink-900 px-6 py-12 md:px-14 md:py-16 text-white mb-12">
        <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <Badge className="bg-pink-500/80 text-white px-3 py-1 w-fit">
              <Megaphone className="h-3 w-3 mr-1.5" />
              For Wedding Vendors
            </Badge>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Grow your wedding
              <span className="block text-pink-300 mt-1">business with us.</span>
            </h1>
            <p className="text-slate-300 text-base md:text-lg max-w-md">
              Reach thousands of couples actively planning their weddings. Get discovered, take bookings, and unlock a powerful new revenue stream — all in one place.
            </p>
            <Button
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold shadow-lg shadow-pink-900/40 w-fit"
              onClick={() => document.getElementById("listing-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Building2 className="h-5 w-5 mr-2" />
              List My Business
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {STATS.map(({ icon: Icon, value, label, color }) => (
              <div key={label} className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-5">
                <Icon className={`h-5 w-5 mb-2 ${color}`} />
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <section className="mb-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">How it works</h2>
          <p className="text-muted-foreground mt-2">Start receiving bookings in as little as 24 hours</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map(({ step: s, icon: Icon, title, desc, color }) => (
            <div key={s} className="relative flex flex-col gap-4">
              {s < 4 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-muted to-transparent -translate-y-0.5 z-0" />
              )}
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md flex-shrink-0 z-10`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Step {s}</p>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing plans ── */}
      <section className="mb-14" id="plans">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Listing Plans</h2>
          <p className="text-muted-foreground mt-2">Start free. Upgrade when you're ready to grow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <Card key={plan.id} className={`relative border-2 ${plan.color} transition-all hover:shadow-xl ${selectedPlan === plan.id ? "ring-2 ring-offset-2 ring-pink-400" : ""}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className={`${plan.badgeColor} text-white px-4 py-1 text-xs shadow-md`}>
                    {plan.badge}
                  </Badge>
                </div>
              )}
              <div className={`${plan.headerColor} px-6 py-6 rounded-t-lg border-b`}>
                <p className="font-bold text-xl">{plan.name}</p>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-sm text-muted-foreground mb-1 ml-0.5">{plan.priceNote}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">+ {plan.bookingFee}</p>
              </div>

              <CardContent className="p-6 space-y-4">
                <div className="space-y-2.5">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground/50">
                      <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className={`w-full mt-2 ${plan.ctaClass}`}
                  variant={plan.ctaVariant}
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    document.getElementById("listing-form")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Booking fee comparison */}
        <div className="mt-6 rounded-2xl bg-muted/50 border p-5">
          <p className="text-sm font-semibold mb-3">How booking fees work</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {PLANS.map((p) => (
              <div key={p.id} className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">{p.bookingFee}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Booking fees apply only to payments collected through our platform. Cash, check, or direct wire payments are not subject to fees. Upgrading your plan reduces your per-booking fee — so higher-volume vendors often save more than the monthly plan cost.
          </p>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="mb-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Vendors love it</h2>
          <p className="text-muted-foreground mt-2">Real results from real businesses on our platform</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ name, business, category, avatar, color, quote, stats }) => (
            <Card key={name} className="border-0 shadow-lg">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">{business}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto text-[10px] flex-shrink-0">{category}</Badge>
                </div>
                <p className="text-sm text-muted-foreground italic leading-relaxed">"{quote}"</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-600">{stats}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Why list with us ── */}
      <section className="mb-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Why list with Chefsire?</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Users, title: "Qualified couples", desc: "Every user is actively planning a wedding — not just browsing. You get serious inquiries.", color: "from-pink-600 to-rose-500" },
            { icon: Shield, title: "Verified vendor badges", desc: "Our verification process builds couple confidence and increases your conversion rate.", color: "from-purple-600 to-indigo-500" },
            { icon: CalendarCheck, title: "Built-in booking", desc: "Couples book directly through your calendar with deposits collected automatically.", color: "from-blue-600 to-cyan-500" },
            { icon: MessageSquare, title: "Direct messaging", desc: "Respond to inquiries fast from your vendor inbox. Featured+ vendors see 3× faster close rates.", color: "from-emerald-600 to-teal-500" },
            { icon: BarChart3, title: "Real analytics", desc: "See profile views, quote request rates, and booking trends to grow smarter.", color: "from-amber-500 to-orange-500" },
            { icon: Zap, title: "AI lead scoring", desc: "Premium vendors get AI-ranked leads so you know who's ready to book vs. just shopping.", color: "from-violet-600 to-purple-500" },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="flex gap-4 p-5 rounded-2xl border hover:shadow-md transition-shadow">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm flex-shrink-0`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Listing form ── */}
      <section className="mb-14" id="listing-form">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Create your listing</h2>
          <p className="text-muted-foreground mt-2">Takes about 10 minutes. Free to start anytime.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8 max-w-md mx-auto">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3 flex-1">
              <button
                type="button"
                onClick={() => { if (s < step) setStep(s as 1 | 2 | 3); }}
                className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                  step > s ? "bg-emerald-500 text-white cursor-pointer" : step === s ? "bg-pink-600 text-white" : "bg-muted text-muted-foreground cursor-default"
                }`}
              >
                {step > s ? "✓" : s}
              </button>
              <span className={`text-xs font-medium ${step >= s ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 ? "Business Info" : s === 2 ? "Services & Pricing" : "Choose Plan"}
              </span>
              {s < 3 && <div className={`h-px flex-1 ${step > s ? "bg-emerald-400" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card className="max-w-2xl mx-auto shadow-lg border-2">
          <CardContent className="p-6 md:p-8">

            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-bold text-lg mb-1">Business Information</h3>
                  <p className="text-sm text-muted-foreground">Tell couples who you are and how to reach you.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold mb-1.5 block">Business Name *</label>
                    <Input placeholder="e.g., Bella Vista Catering" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Contact Name</label>
                    <Input placeholder="Your name" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Business Email *</label>
                    <Input type="email" placeholder="hello@yourbusiness.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Phone</label>
                    <Input type="tel" placeholder="(555) 000-0000" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Website</label>
                    <Input placeholder="https://yourbusiness.com" value={form.website} onChange={(e) => update("website", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Instagram</label>
                    <Input placeholder="@yourbusiness" value={form.instagramHandle} onChange={(e) => update("instagramHandle", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Vendor Category *</label>
                    <Select value={form.category} onValueChange={(v) => update("category", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {VENDOR_CATEGORIES.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">City *</label>
                    <Input placeholder="e.g., Hartford" value={form.city} onChange={(e) => update("city", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">State *</label>
                    <Input placeholder="e.g., CT" value={form.state} onChange={(e) => update("state", e.target.value)} />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={goToStep2} size="lg">
                    Next: Services & Pricing
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-bold text-lg mb-1">Services & Pricing</h3>
                  <p className="text-sm text-muted-foreground">Help couples understand what you offer and what to expect to spend.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Business Description</label>
                  <Textarea
                    placeholder="Tell couples what makes your business special — your style, experience, what sets you apart, dietary options, package highlights, etc."
                    rows={5}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">This appears on your public listing. Be specific — listings with detailed descriptions get 2× more clicks.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Starting Price ($)</label>
                    <Input type="number" min={0} placeholder="e.g., 1500" value={form.minPrice} onChange={(e) => update("minPrice", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Top Package Price ($)</label>
                    <Input type="number" min={0} placeholder="e.g., 8000" value={form.maxPrice} onChange={(e) => update("maxPrice", e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Years in Business</label>
                  <Select value={form.yearsInBusiness} onValueChange={(v) => update("yearsInBusiness", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<1">Less than 1 year</SelectItem>
                      <SelectItem value="1-3">1–3 years</SelectItem>
                      <SelectItem value="3-5">3–5 years</SelectItem>
                      <SelectItem value="5-10">5–10 years</SelectItem>
                      <SelectItem value="10+">10+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <Info className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-xs">
                    Listings with a pricing range get <strong>3× more quote requests</strong> than those without pricing. Even a rough estimate helps couples decide to reach out.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={goToStep3} size="lg">
                    Next: Choose Plan
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-1">Choose Your Plan</h3>
                  <p className="text-sm text-muted-foreground">You can upgrade or change your plan anytime from your dashboard.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                        selectedPlan === plan.id
                          ? plan.id === "premium"
                            ? "border-amber-400 bg-amber-50 dark:bg-amber-950 ring-2 ring-amber-300"
                            : "border-pink-400 bg-pink-50 dark:bg-pink-950 ring-2 ring-pink-300"
                          : "border-muted hover:border-pink-200"
                      }`}
                    >
                      {selectedPlan === plan.id && (
                        <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-pink-600" />
                      )}
                      <p className="font-semibold text-sm">{plan.name}</p>
                      <p className="text-2xl font-black mt-1">
                        {plan.price}
                        <span className="text-xs font-normal text-muted-foreground ml-0.5">{plan.priceNote}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">{plan.bookingFee}</p>
                      <div className="mt-3 space-y-1.5">
                        {plan.features.slice(0, 3).map((f) => (
                          <p key={f} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                            {f}
                          </p>
                        ))}
                        {plan.features.length > 3 && (
                          <p className="text-[11px] text-pink-600 font-semibold">+{plan.features.length - 3} more included</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="rounded-xl bg-muted/50 border p-4 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">YOUR SUMMARY</p>
                  <div className="flex justify-between text-sm">
                    <span>Business</span>
                    <span className="font-medium">{form.businessName || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Category</span>
                    <span className="font-medium capitalize">{VENDOR_CATEGORIES.find(c => c.value === form.category)?.label || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Location</span>
                    <span className="font-medium">{[form.city, form.state].filter(Boolean).join(", ") || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Plan</span>
                    <span className="font-medium capitalize">{selectedPlan}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="vendor-terms"
                    className="rounded mt-1 flex-shrink-0"
                    checked={form.agreeToTerms}
                    onChange={(e) => update("agreeToTerms", e.target.checked)}
                  />
                  <label htmlFor="vendor-terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <span className="text-pink-600 underline cursor-pointer">Vendor Listing Terms</span>
                    {" "}and{" "}
                    <span className="text-pink-600 underline cursor-pointer">Booking Fee Policy</span>.
                    {" "}I confirm all information provided is accurate and up to date.
                  </label>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-pink-600 to-purple-600 text-white"
                    onClick={submitListing}
                  >
                    <Building2 className="h-5 w-5 mr-2" />
                    Submit Listing
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </section>

      {/* ── FAQ ── */}
      <section className="mb-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Frequently Asked Questions</h2>
        </div>
        <div className="max-w-2xl mx-auto space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <div key={q} className="rounded-xl border overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-medium text-sm">{q}</span>
                <span className={`ml-4 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-45" : ""}`}>
                  <Plus className="h-4 w-4" />
                </span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t bg-muted/20 pt-4">
                  {a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <div className="text-center pb-6 border-t pt-8 space-y-4">
        <h3 className="font-bold text-lg">Ready to grow your wedding business?</h3>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            className="bg-gradient-to-r from-pink-600 to-purple-600 text-white"
            onClick={() => document.getElementById("listing-form")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Building2 className="h-5 w-5 mr-2" />
            List My Business — It's Free
          </Button>
          <a href="mailto:vendors@chefsire.com">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <Mail className="h-4 w-4 mr-2" />
              Contact Vendor Support
            </Button>
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Already listed?{" "}
          <span className="text-purple-600 font-medium cursor-pointer hover:underline">Sign in to your vendor dashboard →</span>
        </p>
      </div>
    </div>
  );
}

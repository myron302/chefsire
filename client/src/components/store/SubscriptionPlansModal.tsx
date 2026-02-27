import React from "react";
import { Check, Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export interface SubscriptionPlan {
  id: "free" | "starter" | "pro" | "enterprise";
  name: string;
  price: number;
  description: string;
  features: string[];
  commission: string;
  productLimit: string;
  popular?: boolean;
}

export const PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Start selling today",
    commission: "15% on shipped • 0% pickup/in-store",
    productLimit: "Up to 25 products",
    features: [
      "Up to 25 products",
      "Basic storefront",
      "15% commission on shipped sales",
      "0% on pickup/in-store sales",
      "Digital products supported",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 19,
    description: "Perfect for getting started",
    commission: "10% on shipped • 0% pickup/in-store",
    productLimit: "Up to 100 products",
    features: [
      "Up to 100 products",
      "10% commission on shipped sales",
      "0% on pickup/in-store sales",
      "Custom store branding",
      "Basic analytics",
    ],
  },
  {
    id: "pro",
    name: "Professional",
    price: 49,
    description: "For growing businesses",
    commission: "5% on shipped • 0% pickup/in-store",
    productLimit: "Unlimited products",
    popular: true,
    features: [
      "Unlimited products",
      "5% commission on shipped sales",
      "0% on pickup/in-store sales",
      "Advanced customization",
      "Priority support & analytics",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    description: "For large operations",
    commission: "2% on shipped • 0% pickup/in-store",
    productLimit: "Unlimited products",
    features: [
      "Unlimited products",
      "2% commission on shipped sales",
      "0% on pickup/in-store sales",
      "White-label & API access",
      "24/7 dedicated support",
    ],
  },
];

interface SubscriptionPlansModalProps {
  onClose: () => void;
  redirectAfter?: string;
}

export default function SubscriptionPlansModal({
  onClose,
  redirectAfter = "/store/create",
}: SubscriptionPlansModalProps) {
  const { user, updateUser } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (!user) return;

    const trialEnd =
      plan.id !== "free"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    updateUser({ subscription: plan.id, trialEndDate: trialEnd });
    onClose();

    toast({
      title: plan.id === "free" ? "Free plan activated!" : "Trial activated!",
      description:
        plan.id === "free"
          ? "Create your store now!"
          : `30-day ${plan.name} trial activated. Create your store now!`,
    });

    setTimeout(() => setLocation(redirectAfter), 800);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Crown className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Choose Your Store Plan</h2>
              <p className="text-sm text-gray-500">
                30-day free trial on paid plans • No credit card required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plans Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border-2 p-5 flex flex-col transition-shadow hover:shadow-lg ${
                plan.popular
                  ? "border-orange-500 shadow-md"
                  : "border-gray-200 hover:border-orange-300"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-orange-500 text-white text-xs px-3 py-0.5 shadow">
                    Most Popular
                  </Badge>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-orange-600">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>
                <p className="text-xs text-gray-500">{plan.description}</p>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelectPlan(plan)}
                className={
                  plan.popular
                    ? "w-full bg-orange-500 hover:bg-orange-600 text-white"
                    : "w-full"
                }
                variant={plan.popular ? "default" : "outline"}
              >
                {plan.id === "free" ? "Start Free" : "Start Free Trial"}
              </Button>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 text-center text-sm text-gray-400">
          All paid plans include a 30-day free trial • Cancel anytime
        </div>
      </div>
    </div>
  );
}

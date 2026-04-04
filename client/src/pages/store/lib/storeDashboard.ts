import type { LucideIcon } from "lucide-react";
import { DollarSign, Eye, Package, ShoppingCart, TrendingUp } from "lucide-react";

export interface DashboardStats {
  totalProducts: number;
  publishedProducts: number;
  totalViews: number;
  totalSales: number;
  revenue: number;
  monthlyRevenue: number;
}

export interface DashboardStatCard {
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  iconClass?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  commission: string;
  features: string[];
  popular?: boolean;
}

export const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  totalProducts: 0,
  publishedProducts: 0,
  totalViews: 0,
  totalSales: 0,
  revenue: 0,
  monthlyRevenue: 0,
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "starter", name: "Starter", price: 15, commission: "8%", features: ["Up to 100 products", "Custom branding", "Basic analytics"] },
  { id: "professional", name: "Professional", price: 35, commission: "5%", features: ["Unlimited products", "Advanced analytics", "Priority support"], popular: true },
  { id: "enterprise", name: "Enterprise", price: 75, commission: "2%", features: ["Everything in Pro", "White-label", "Dedicated support"] },
];

export const getInitialProductStats = () => ({
  totalProducts: 0,
  publishedProducts: 0,
});

export const getInitialStoreStats = () => ({
  totalViews: 0,
  totalSales: 0,
  totalRevenue: 0,
});

export const buildMainStatsCards = (stats: DashboardStats): DashboardStatCard[] => [
  { label: "Total Products", value: stats.totalProducts, sub: `${stats.publishedProducts} published`, icon: Package, iconClass: "text-orange-500 bg-orange-100" },
  { label: "Store Views", value: stats.totalViews, sub: "+12% this week", icon: Eye, iconClass: "text-blue-500 bg-blue-100" },
  { label: "Total Sales", value: stats.totalSales, sub: "All time", icon: ShoppingCart, iconClass: "text-green-500 bg-green-100" },
  { label: "Revenue", value: `$${Number(stats.revenue).toLocaleString()}`, sub: "All time", icon: DollarSign, iconClass: "text-purple-500 bg-purple-100" },
];

export const buildAnalyticsCards = (stats: DashboardStats): DashboardStatCard[] => [
  { label: "Total Products", value: stats.totalProducts, sub: `${stats.publishedProducts} active`, icon: Package },
  { label: "Total Sales", value: stats.totalSales, sub: "All time", icon: ShoppingCart },
  { label: "Monthly Revenue", value: `$${Number(stats.monthlyRevenue).toFixed(2)}`, sub: "This month", icon: DollarSign },
  { label: "Total Views", value: stats.totalViews, sub: "Product views", icon: TrendingUp },
];

export const calculateTrialDaysLeft = (trialEndDate?: string) => {
  if (!trialEndDate) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / 86400000));
};

export const buildSubscriptionCheckoutPayload = (
  tierName: string,
  isTrial: boolean,
  user: { id: string; email: string },
) => ({
  tier: tierName,
  trial: isTrial,
  userId: user.id,
  email: user.email,
});

export const isMissingPlanVariationError = (errorMsg: string) =>
  errorMsg.includes("Missing plan variation");

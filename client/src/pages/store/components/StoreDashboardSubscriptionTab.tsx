import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SUBSCRIPTION_PLANS } from "../lib/storeDashboard";

type TierInfo = {
  name?: string;
  commission?: number;
  features?: string[];
};

type StoreDashboardSubscriptionTabProps = {
  currentTier: string;
  tierInfo?: TierInfo;
  trialDaysLeft: number;
  onUpgrade: (tierName: string, isTrial?: boolean) => void;
};

export default function StoreDashboardSubscriptionTab({
  currentTier,
  tierInfo,
  trialDaysLeft,
  onUpgrade,
}: StoreDashboardSubscriptionTabProps) {
  return (
    <>
      <Card className="mb-6 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Crown className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Current Plan: {tierInfo?.name || currentTier}</CardTitle>
                {trialDaysLeft > 0 && (
                  <p className="text-sm text-orange-600 mt-0.5">Trial active · {trialDaysLeft} days remaining</p>
                )}
              </div>
            </div>
            {tierInfo?.commission !== undefined && (
              <Badge className="bg-orange-500">{tierInfo.commission}% commission</Badge>
            )}
          </div>
        </CardHeader>
        {tierInfo?.features && (
          <CardContent>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {tierInfo.features.map((feature, index) => (
                <span key={index} className="text-sm text-gray-700 flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> {feature}
                </span>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Upgrade to reduce commission fees and unlock more features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div key={plan.id} className={`relative border-2 rounded-xl p-5 ${plan.popular ? "border-orange-500" : "border-gray-200"}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-orange-500">Recommended</Badge>
                  </div>
                )}
                <h4 className="font-bold mb-1">{plan.name}</h4>
                <div className="text-2xl font-bold mb-1">
                  ${plan.price}<span className="text-sm text-gray-500 font-normal">/mo</span>
                </div>
                <p className="text-sm text-green-600 font-medium mb-3">{plan.commission} commission</p>
                <ul className="space-y-1 mb-5">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center gap-1.5">
                      <span className="text-green-500">✓</span> {feature}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Button
                    onClick={() => onUpgrade(plan.id, false)}
                    className={`w-full ${plan.popular ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    disabled={currentTier === plan.id}
                  >
                    {currentTier === plan.id ? "Current Plan" : "Upgrade with Square"}
                  </Button>
                  {currentTier !== plan.id && (
                    <Button
                      onClick={() => onUpgrade(plan.id, true)}
                      variant="ghost"
                      className="w-full text-sm text-gray-500 hover:text-gray-800"
                    >
                      Start 30-day free trial
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, X } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useLocation } from "wouter";
import { useState } from "react";

interface ProfileCompletionItem {
  key: string;
  label: string;
  completed: boolean;
  action?: () => void;
}

export function ProfileCompletion({ onDismiss }: { onDismiss?: () => void }) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!user || dismissed) return null;

  const items: ProfileCompletionItem[] = [
    {
      key: "avatar",
      label: "Add profile photo",
      completed: !!user.avatarUrl,
      action: () => setLocation("/settings"),
    },
    {
      key: "displayName",
      label: "Set display name",
      completed: !!user.displayName,
      action: () => setLocation("/settings"),
    },
    {
      key: "bio",
      label: "Write a bio",
      completed: !!user.bio && user.bio.length > 10,
      action: () => setLocation("/settings"),
    },
    {
      key: "location",
      label: "Add your location",
      completed: !!user.location,
      action: () => setLocation("/settings"),
    },
    {
      key: "website",
      label: "Add website or social link",
      completed: !!user.website,
      action: () => setLocation("/settings"),
    },
  ];

  const completedCount = items.filter(item => item.completed).length;
  const percentage = Math.round((completedCount / items.length) * 100);

  // Don't show if profile is 100% complete
  if (percentage === 100) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>Complete Your Profile</span>
            <span className="text-sm font-normal text-gray-600">
              {percentage}%
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={percentage} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-gray-600 mb-3">
          A complete profile helps you connect with other food enthusiasts!
        </p>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-orange-50/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400" />
                )}
                <span
                  className={`text-sm ${
                    item.completed ? "text-gray-500 line-through" : "text-gray-700"
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {!item.completed && item.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                  onClick={item.action}
                >
                  Add
                </Button>
              )}
            </div>
          ))}
        </div>
        {percentage >= 80 && percentage < 100 && (
          <div className="mt-3 p-2 bg-orange-100 rounded-md">
            <p className="text-xs text-orange-800">
              🎉 Almost there! Complete your profile to unlock full features.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { ChefHat, Clock, Package, Plus, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PrepTabSection = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Batch Cooking Planner</CardTitle>
          <CardDescription>Prepare multiple meals efficiently</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Sunday Meal Prep</h4>
                  <p className="text-sm text-gray-600 mb-3">Prepare 5 meals in 2 hours</p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>• Cook 2lbs chicken breast</li>
                    <li>• Roast vegetables (carrots, broccoli)</li>
                    <li>• Prepare 3 cups quinoa</li>
                    <li>• Portion into containers</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-green-600 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Wednesday Prep</h4>
                  <p className="text-sm text-gray-600 mb-3">Quick 30-minute session</p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>• Hard boil 6 eggs</li>
                    <li>• Prep overnight oats</li>
                    <li>• Cut fruit for snacks</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Create Prep Session
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage Tips</CardTitle>
          <CardDescription>Keep your meals fresh</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <StorageTip
              icon={<ChefHat className="w-5 h-5 text-orange-500" />}
              title="Chicken & Rice"
              tip="Refrigerate up to 4 days, freeze up to 3 months"
            />
            <StorageTip
              icon={<Utensils className="w-5 h-5 text-green-500" />}
              title="Chopped Vegetables"
              tip="Store in airtight container, use within 3-5 days"
            />
            <StorageTip
              icon={<Package className="w-5 h-5 text-blue-500" />}
              title="Cooked Grains"
              tip="Refrigerate up to 5 days, freeze up to 6 months"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StorageTip = ({ icon, title, tip }: { icon: React.ReactNode; title: string; tip: string }) => (
  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
    {icon}
    <div>
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <p className="text-xs text-gray-600">{tip}</p>
    </div>
  </div>
);

export default PrepTabSection;

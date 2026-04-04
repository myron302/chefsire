import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StoreCustomization from "@/components/store/StoreCustomization";

type StoreDashboardCustomizeTabProps = {
  store: any;
  onUpdate: (updates: any) => void;
};

export default function StoreDashboardCustomizeTab({ store, onUpdate }: StoreDashboardCustomizeTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Customization</CardTitle>
        <CardDescription>Branding, banner, about section, social links, and layout</CardDescription>
      </CardHeader>
      <CardContent>
        <StoreCustomization store={store} onUpdate={onUpdate} />
      </CardContent>
    </Card>
  );
}

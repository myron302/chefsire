import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ThemeSelector from "@/components/store/ThemeSelector";

type StoreDashboardThemeTabProps = {
  selectedTheme: string;
  onSelectTheme: (themeId: string) => void;
};

export default function StoreDashboardThemeTab({ selectedTheme, onSelectTheme }: StoreDashboardThemeTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Theme</CardTitle>
        <CardDescription>Choose a pre-designed colour theme for your storefront</CardDescription>
      </CardHeader>
      <CardContent>
        <ThemeSelector selectedTheme={selectedTheme} onSelectTheme={onSelectTheme} />
      </CardContent>
    </Card>
  );
}

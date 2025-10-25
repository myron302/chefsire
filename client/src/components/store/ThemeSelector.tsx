import React from 'react';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Theme {
  id: string;
  name: string;
  description: string;
  preview: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const THEMES: Theme[] = [
  {
    id: 'modern',
    name: 'Modern Minimalist',
    description: 'Clean and simple design with focus on products',
    preview: '/themes/modern.jpg',
    colors: {
      primary: '#FF6B35',
      secondary: '#2C3E50',
      accent: '#F7F7F7',
    },
  },
  {
    id: 'elegant',
    name: 'Elegant Classic',
    description: 'Sophisticated design with serif fonts and subtle colors',
    preview: '/themes/elegant.jpg',
    colors: {
      primary: '#8B4513',
      secondary: '#F5E6D3',
      accent: '#2C2416',
    },
  },
  {
    id: 'vibrant',
    name: 'Vibrant & Bold',
    description: 'Eye-catching colors perfect for food and culinary products',
    preview: '/themes/vibrant.jpg',
    colors: {
      primary: '#FF5722',
      secondary: '#FFC107',
      accent: '#4CAF50',
    },
  },
  {
    id: 'rustic',
    name: 'Rustic Farmhouse',
    description: 'Warm and inviting with natural tones',
    preview: '/themes/rustic.jpg',
    colors: {
      primary: '#8B6F47',
      secondary: '#E8DCC4',
      accent: '#5C4033',
    },
  },
];

interface ThemeSelectorProps {
  selectedTheme: string;
  onSelectTheme: (themeId: string) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  selectedTheme,
  onSelectTheme,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {THEMES.map((theme) => {
          const isSelected = selectedTheme === theme.id;

          return (
            <Card
              key={theme.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                isSelected ? 'ring-2 ring-orange-500' : ''
              }`}
              onClick={() => onSelectTheme(theme.id)}
            >
              <div className="relative">
                {/* Preview Image */}
                <div className="h-32 bg-gradient-to-br overflow-hidden rounded-t-lg relative"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
                  }}
                >
                  {/* Mock store layout preview */}
                  <div className="absolute inset-0 p-4 text-white">
                    <div className="text-xs font-semibold mb-2">Store Preview</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-12 bg-white/20 rounded backdrop-blur-sm"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Selected Badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <Check size={16} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Theme Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{theme.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
                    </div>
                  </div>

                  {/* Color Palette */}
                  <div className="flex gap-2 mt-3">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-200"
                      style={{ backgroundColor: theme.colors.primary }}
                      title="Primary"
                    />
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-200"
                      style={{ backgroundColor: theme.colors.secondary }}
                      title="Secondary"
                    />
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-200"
                      style={{ backgroundColor: theme.colors.accent }}
                      title="Accent"
                    />
                  </div>

                  {isSelected && (
                    <Badge className="mt-3 bg-orange-500">Selected</Badge>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Theme Features */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-semibold mb-2 text-sm">All themes include:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>✓ Mobile-responsive design</li>
          <li>✓ Product grid and detail pages</li>
          <li>✓ Customizable colors and fonts</li>
          <li>✓ Shopping cart integration</li>
        </ul>
      </Card>
    </div>
  );
};

export default ThemeSelector;

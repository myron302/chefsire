// client/src/pages/store/StoreViewer.tsx
import * as React from "react";
import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Button as UIButton } from "@/components/ui/button";
import { Package, Edit as EditIcon, Instagram, Facebook, Twitter, Mail, Phone, MapPin, Clock } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { THEMES } from "@/components/store/ThemeSelector";

type Store = {
  id: string;
  userId: string;
  handle: string;
  name: string;
  bio: string;
  theme: Record<string, unknown>;
  layout: any;
  published: boolean;
};

export default function StoreViewer() {
  const { user } = useUser();
  const [, params] = useRoute("/store/:handle");
  const handle = params?.handle ?? "";
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Get customization from layout field
  const customization = store?.layout || {};

  // Get theme colors (can be overridden by custom colors)
  const getThemeColors = () => {
    // If custom colors are defined, use those
    if (customization.colors) {
      return customization.colors;
    }

    // Otherwise use theme colors
    const themeId = (store?.theme as any) || 'modern';
    const theme = THEMES.find(t => t.id === themeId);
    return theme?.colors || THEMES[0].colors;
  };

  const themeColors = store ? getThemeColors() : THEMES[0].colors;

  // Layout settings
  const gridCols = customization.layout?.gridColumns || 4;
  const cardStyle = customization.layout?.productCardStyle || 'elevated';
  const spacing = customization.layout?.spacing || 'normal';

  const gridColsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  }[gridCols] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  const gapClass = {
    compact: 'gap-3',
    normal: 'gap-6',
    relaxed: 'gap-8',
  }[spacing] || 'gap-6';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/stores/${handle}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setStore(data.store ?? null);
            // Load products for this store
            if (data.store?.userId) {
              const productsRes = await fetch(`/api/marketplace/sellers/${data.store.userId}/products`);
              if (productsRes.ok) {
                const productsData = await productsRes.json();
                setProducts(productsData.products || []);
              }
            }
          }
        } else {
          if (mounted) setStore(null);
        }
      } catch (e) {
        console.error("load store", e);
        if (mounted) setStore(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading store…
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-600 p-6">
        <Package className="w-12 h-12 mb-4 text-gray-400" />
        <p>This store was not found.</p>
      </div>
    );
  }

  const isOwner = user && user.id === store.userId;

  // Only show unpublished stores to the owner
  if (!store.published && !isOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-600 p-6">
        <Package className="w-12 h-12 mb-4 text-gray-400" />
        <p>This store is not available.</p>
      </div>
    );
  }

  const socialLinks = customization.socialLinks || {};
  const contactInfo = customization.contactInfo || {};

  return (
    <div className="min-h-screen" style={{ backgroundColor: themeColors.accent }}>
      {/* Announcement Bar */}
      {customization.announcementEnabled && customization.announcementBar && (
        <div className="text-white text-center py-2 px-4 text-sm font-medium" style={{ backgroundColor: themeColors.primary }}>
          {customization.announcementBar}
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Logo */}
              {customization.logo && (
                <img src={customization.logo} alt={store.name} className="h-12 w-12 object-contain" />
              )}
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-bold" style={{ color: themeColors.primary }}>
                  {store.name}
                </h1>
                {store.bio && <p className="text-gray-600 mt-1 text-sm">{store.bio}</p>}
                {!store.published && isOwner && (
                  <Badge variant="secondary" className="mt-2">Draft - Not Published</Badge>
                )}
              </div>
            </div>
            {isOwner && (
              <Link href="/store/dashboard">
                <UIButton variant="outline" className="w-full md:w-auto" style={{ borderColor: themeColors.primary, color: themeColors.primary }}>
                  <EditIcon className="w-4 h-4 mr-2" />
                  Manage Store
                </UIButton>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      {customization.showBanner && (
        <div
          className="relative h-64 md:h-80 flex items-center justify-center text-white overflow-hidden"
          style={{
            background: customization.bannerImage
              ? `url(${customization.bannerImage}) center/cover`
              : `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`
          }}
        >
          {customization.bannerImage && <div className="absolute inset-0 bg-black/40"></div>}
          <div className="relative z-10 text-center px-4">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">
              {customization.bannerTitle || 'Welcome to Our Store'}
            </h2>
            {customization.bannerSubtitle && (
              <p className="text-lg md:text-xl opacity-95 drop-shadow-md">
                {customization.bannerSubtitle}
              </p>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* About Section */}
        {customization.aboutEnabled && customization.aboutContent && (
          <div className="mb-12 bg-white rounded-xl p-8 shadow-sm">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: themeColors.primary }}>
              {customization.aboutTitle || 'About Us'}
            </h2>
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">
              {customization.aboutContent}
            </p>
          </div>
        )}

        {/* Products Section */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: themeColors.secondary }}>
                Our Products
              </h2>
              <p className="text-gray-600">Discover our collection of premium culinary products</p>
            </div>
            {isOwner && products.length > 0 && (
              <Link href="/store/products/new">
                <UIButton className="hidden md:block" style={{ backgroundColor: themeColors.primary }}>
                  Add Product
                </UIButton>
              </Link>
            )}
          </div>

          {products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6" style={{ backgroundColor: `${themeColors.primary}20` }}>
                <Package className="w-10 h-10" style={{ color: themeColors.primary }} />
              </div>
              <h3 className="text-xl font-semibold mb-2">No products yet</h3>
              <p className="text-gray-600 mb-6">This store hasn't added any products yet. Check back soon!</p>
              {isOwner && (
                <Link href="/store/products/new">
                  <UIButton className="mt-4" style={{ backgroundColor: themeColors.primary }}>
                    Add Your First Product
                  </UIButton>
                </Link>
              )}
            </div>
          ) : (
            <div className={`grid ${gridColsClass} ${gapClass}`}>
              {products.map((product) => (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl overflow-hidden transition-all duration-300 ${
                    cardStyle === 'elevated'
                      ? 'shadow-sm hover:shadow-2xl transform hover:-translate-y-2'
                      : 'border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="relative">
                    {product.images?.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-56 object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-56 flex items-center justify-center"
                        style={{ backgroundColor: `${themeColors.secondary}20` }}
                      >
                        <Package className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    {!product.isActive && isOwner && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary">Draft</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-2 line-clamp-1">{product.name}</h3>
                    {product.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2 min-h-[40px]">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-2xl font-bold" style={{ color: themeColors.primary }}>
                        ${parseFloat(product.price).toFixed(2)}
                      </span>
                      <Link href={`/marketplace/product/${product.id}`}>
                        <UIButton
                          size="sm"
                          className="text-white hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          View
                        </UIButton>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact & Social Section */}
        {((socialLinks.instagram || socialLinks.facebook || socialLinks.twitter || socialLinks.email || socialLinks.phone) ||
          (contactInfo.address || contactInfo.hours)) && (
          <div className="mt-16 bg-white rounded-xl p-8 shadow-sm">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Contact Info */}
              {(contactInfo.address || contactInfo.hours) && (
                <div>
                  <h3 className="text-xl font-bold mb-4" style={{ color: themeColors.primary }}>
                    Visit Us
                  </h3>
                  {contactInfo.address && (
                    <div className="flex gap-3 mb-4">
                      <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-700 whitespace-pre-line">{contactInfo.address}</p>
                    </div>
                  )}
                  {contactInfo.hours && (
                    <div className="flex gap-3">
                      <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-700 whitespace-pre-line">{contactInfo.hours}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Social & Contact Links */}
              {(socialLinks.instagram || socialLinks.facebook || socialLinks.twitter || socialLinks.email || socialLinks.phone) && (
                <div>
                  <h3 className="text-xl font-bold mb-4" style={{ color: themeColors.primary }}>
                    Connect With Us
                  </h3>
                  <div className="space-y-3">
                    {socialLinks.email && (
                      <a href={`mailto:${socialLinks.email}`} className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors">
                        <Mail className="w-5 h-5" style={{ color: themeColors.primary }} />
                        <span>{socialLinks.email}</span>
                      </a>
                    )}
                    {socialLinks.phone && (
                      <a href={`tel:${socialLinks.phone}`} className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors">
                        <Phone className="w-5 h-5" style={{ color: themeColors.primary }} />
                        <span>{socialLinks.phone}</span>
                      </a>
                    )}
                    {socialLinks.instagram && (
                      <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors">
                        <Instagram className="w-5 h-5" style={{ color: themeColors.primary }} />
                        <span>Instagram</span>
                      </a>
                    )}
                    {socialLinks.facebook && (
                      <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors">
                        <Facebook className="w-5 h-5" style={{ color: themeColors.primary }} />
                        <span>Facebook</span>
                      </a>
                    )}
                    {socialLinks.twitter && (
                      <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors">
                        <Twitter className="w-5 h-5" style={{ color: themeColors.primary }} />
                        <span>Twitter</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t" style={{ backgroundColor: themeColors.secondary, borderColor: themeColors.primary }}>
        <div className="max-w-7xl mx-auto px-4 text-center text-white/80 text-sm">
          <p>© {new Date().getFullYear()} {store.name}. All rights reserved.</p>
          <p className="mt-1">Powered by ChefSire Marketplace</p>
        </div>
      </footer>
    </div>
  );
}

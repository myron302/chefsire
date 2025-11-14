import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  Store,
  Package,
  DollarSign,
  TrendingUp,
  Users,
  Settings,
  Eye,
  Edit,
  Plus,
  BarChart3,
  ShoppingCart,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';
import { ProductManager } from '@/components/store/ProductManager';

interface DashboardStats {
  totalProducts: number;
  publishedProducts: number;
  totalViews: number;
  totalSales: number;
  revenue: number;
}

export default function StoreDashboard() {
  const { user } = useUser();
  const [store, setStore] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    publishedProducts: 0,
    totalViews: 0,
    totalSales: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoreData();
  }, [user]);

  const loadStoreData = async () => {
    if (!user?.id) return;

    try {
      // Load store info
      const storeRes = await fetch(`/api/stores/user/${user.id}`);
      if (storeRes.ok) {
        const storeData = await storeRes.json();
        setStore(storeData.store);

        // Load actual product stats
        const productsRes = await fetch(`/api/marketplace/products/seller/${user.id}`);
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const products = productsData.products || [];

          setStats({
            totalProducts: products.length,
            publishedProducts: products.filter((p: any) => p.isActive).length,
            totalViews: 0, // TODO: Implement view tracking
            totalSales: 0, // TODO: Implement sales tracking
            revenue: 0, // TODO: Implement revenue tracking
          });
        } else {
          // If products endpoint fails, set zeros
          setStats({
            totalProducts: 0,
            publishedProducts: 0,
            totalViews: 0,
            totalSales: 0,
            revenue: 0,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load store:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Store className="mx-auto w-12 h-12 text-gray-400 animate-pulse" />
          <p className="mt-4 text-gray-600">Loading your store...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <Store className="mx-auto w-16 h-16 text-gray-400" />
          <h1 className="text-2xl font-bold mt-4">No Store Found</h1>
          <p className="text-gray-600 mt-2 mb-6">
            You haven't created a store yet. Create one to start selling your products!
          </p>
          <Link href="/store/setup">
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="mr-2" size={16} />
              Create Your Store
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Store Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Manage your store: {store.name}
              </p>
            </div>
            <div className="flex gap-3">
              <Link href={`/store/${store.handle}`}>
                <Button variant="outline">
                  <Eye size={16} className="mr-2" />
                  View Store
                </Button>
              </Link>
              <Link href="/store/settings">
                <Button variant="outline">
                  <Settings size={16} className="mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-4">
            <Badge
              variant={store.published ? 'default' : 'secondary'}
              className={store.published ? 'bg-green-600' : 'bg-gray-400'}
            >
              {store.published ? 'Published' : 'Unpublished'}
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Products
              </CardTitle>
              <Package className="text-gray-400" size={20} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-gray-600 mt-1">
                {stats.publishedProducts} published
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Store Views
              </CardTitle>
              <Eye className="text-gray-400" size={20} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalViews}</div>
              <p className="text-xs text-green-600 mt-1 flex items-center">
                <TrendingUp size={12} className="mr-1" />
                +12% from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Sales
              </CardTitle>
              <ShoppingCart className="text-gray-400" size={20} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalSales}</div>
              <p className="text-xs text-gray-600 mt-1">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Revenue
              </CardTitle>
              <DollarSign className="text-gray-400" size={20} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${stats.revenue.toLocaleString()}
              </div>
              <p className="text-xs text-green-600 mt-1 flex items-center">
                <TrendingUp size={12} className="mr-1" />
                +8% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Product Management</CardTitle>
                  <Link href="/store/products/new">
                    <Button className="bg-orange-500 hover:bg-orange-600">
                      <Plus size={16} className="mr-2" />
                      {stats.totalProducts === 0 ? 'Add Your First Product' : 'Add Product'}
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <ProductManager storeId={store.id} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No orders yet</p>
                  <p className="text-sm mt-2">Orders will appear here when customers make purchases</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Store Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Analytics coming soon</p>
                  <p className="text-sm mt-2">Track your store's performance and customer insights</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/store/settings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <Edit className="text-orange-500 mb-3" size={24} />
                <h3 className="font-semibold mb-2">Customize Store</h3>
                <p className="text-sm text-gray-600">
                  Update your store's appearance and branding
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <Users className="text-blue-500 mb-3" size={24} />
              <h3 className="font-semibold mb-2">Customer Insights</h3>
              <p className="text-sm text-gray-600">
                View customer analytics and behavior
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <AlertCircle className="text-purple-500 mb-3" size={24} />
              <h3 className="font-semibold mb-2">Marketing Tools</h3>
              <p className="text-sm text-gray-600">
                Promote your store and products
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

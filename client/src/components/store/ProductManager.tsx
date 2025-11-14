import React, { useState, useEffect } from 'react';
import { Edit, Trash, Image as ImageIcon, Package } from 'lucide-react';
import { Link } from 'wouter';
import { Product } from '../../types/store';
import { getStoreProducts, deleteProduct } from '../../lib/store/products';

interface ProductManagerProps {
  sellerId: string;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ sellerId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [sellerId]);

  const loadProducts = async () => {
    try {
      const storeProducts = await getStoreProducts(sellerId);
      setProducts(storeProducts);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    setLoading(true);
    try {
      await deleteProduct(productId);
      await loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-gray-600">Manage your store products</p>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-square bg-gray-100 flex items-center justify-center">
              {product.images && product.images.length > 0 ? (
                <img 
                  src={product.images[0]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-gray-400" />
              )}
            </div>
            
            <div className="p-4">
              <h3 className="font-semibold text-lg">{product.name}</h3>
              <p className="text-gray-600 text-sm mt-1 line-clamp-2">{product.description}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="font-bold text-lg">${product.price}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  product.inventory > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {product.inventory} in stock
                </span>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Link href={`/store/products/edit/${product.id}`}>
                  <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors">
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                </Link>
                <button
                  onClick={() => handleDelete(product.id)}
                  disabled={loading}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  <Trash className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Package className="mx-auto w-12 h-12 text-gray-400" />
          <h3 className="mt-4 font-medium text-gray-900">No products yet</h3>
          <p className="text-gray-500 mt-1">Add your first product to get started</p>
          <Link href="/store/products/new">
            <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Add Your First Product
            </button>
          </Link>
        </div>
      )}
    </div>
  );
};

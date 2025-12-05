"use client";

import {useEffect, useState, useCallback} from "react";
import {Product} from "./types";
import {apiClient} from "./lib/api";
import ProductCard from "./components/ProductCard";
import LoadingSpinner from "./components/LoadingSpinner";

export default function Home() {
     const [products, setProducts] = useState<Product[]>([]);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState<string | null>(null);

     const fetchProducts = useCallback(async () => {
          try {
               setError(null);
               const data = await apiClient.getProducts();
               // Sort products by ID to maintain consistent order
               const sortedData = [...data].sort((a, b) =>
                    a.id.localeCompare(b.id)
               );
               setProducts(sortedData);
          } catch (err) {
               setError(
                    err instanceof Error
                         ? err.message
                         : "Failed to load products"
               );
          } finally {
               setLoading(false);
          }
     }, []);

     useEffect(() => {
          fetchProducts();
     }, [fetchProducts]);

     if (loading) {
          return (
               <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                    <div className="text-center">
                         <LoadingSpinner
                              size="lg"
                              className="mb-4 border-blue-600"
                         />
                         <div className="text-xl font-semibold text-gray-700">
                              Loading products...
                         </div>
                    </div>
               </div>
          );
     }

     return (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center mb-12">
                         <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                              Product Reservation System
                         </h1>
                         <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                              Reserve your favorite products for 2 minutes.
                              Complete your purchase before time runs out!
                         </p>
                    </div>

                    {error && (
                         <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm">
                              <div className="flex items-center">
                                   <svg
                                        className="h-5 w-5 text-red-500 shrink-0"
                                        viewBox="0 0 20 20"
                                        fill="currentColor">
                                        <path
                                             fillRule="evenodd"
                                             d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                             clipRule="evenodd"
                                        />
                                   </svg>
                                   <p className="ml-3 text-sm font-medium text-red-800">
                                        {error}
                                   </p>
                              </div>
                         </div>
                    )}

                    {products.length === 0 ? (
                         <div className="text-center py-16">
                              <div className="text-gray-400 text-lg mb-2">
                                   No products available
                              </div>
                              <p className="text-gray-500 text-sm">
                                   Check back later for new products
                              </p>
                         </div>
                    ) : (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                              {products.map((product) => (
                                   <ProductCard
                                        key={product.id}
                                        product={product}
                                        onReservationChange={fetchProducts}
                                   />
                              ))}
                         </div>
                    )}
               </div>
          </div>
     );
}

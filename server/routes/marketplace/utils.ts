export function countProductsByCategory(products: any[]) {
  return {
    spices: products.filter((p: any) => p.category === "spices").length,
    ingredients: products.filter((p: any) => p.category === "ingredients").length,
    cookware: products.filter((p: any) => p.category === "cookware").length,
    cookbooks: products.filter((p: any) => p.category === "cookbooks").length,
    sauces: products.filter((p: any) => p.category === "sauces").length,
    baked_goods: products.filter((p: any) => p.category === "baked_goods").length,
    prepared_foods: products.filter((p: any) => p.category === "prepared_foods").length,
    beverages: products.filter((p: any) => p.category === "beverages").length,
    other: products.filter((p: any) => p.category === "other").length,
  };
}

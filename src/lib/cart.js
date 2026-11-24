export function reconcileCartItems(items, products) {
  const stockById = new Map(
    products.map((product) => [String(product.id), Number(product.stock ?? 0)])
  );

  return items.flatMap((item) => {
    const stock = stockById.get(String(item.id));
    if (stock == null || stock <= 0) return [];
    return [{
      ...item,
      stock,
      quantity: Math.min(Number(item.quantity) || 1, stock),
    }];
  });
}

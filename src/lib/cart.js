export function reconcileCartItems(items, products) {
  const productsById = new Map(products.map((product) => [String(product.id), product]));

  return items.flatMap((item) => {
    const product = productsById.get(String(item.id));
    const stock = Number(product?.stock ?? 0);
    if (!product || stock <= 0) return [];
    return [{
      ...item,
      stock,
      ...(product.price == null ? {} : { price: Number(product.price) }),
      ...(Object.hasOwn(product, "originalPrice") ? { originalPrice: product.originalPrice } : {}),
      ...(Object.hasOwn(product, "offerPrice") || Object.hasOwn(product, "offerStartsAt")
        ? {
            offerPrice: product.offerPrice ?? product.price,
            compareAtPrice: product.compareAtPrice ?? product.originalPrice,
            offerStartsAt: product.offerStartsAt ?? null,
            offerEndsAt: product.offerEndsAt ?? null,
          }
        : {}),
      quantity: Math.min(Number(item.quantity) || 1, stock),
    }];
  });
}

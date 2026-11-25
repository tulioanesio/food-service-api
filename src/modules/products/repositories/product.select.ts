export const publicProductSelect = {
  id: true,
  name: true,
  category: true,
  price: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  stock: {
    select: {
      totalQuantity: true,
      minimumQuantity: true,
      inputQuantity: true,
      outputQuantity: true,
      updatedAt: true,
    },
  },
} as const;

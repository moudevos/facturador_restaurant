"use client";

import { create } from "zustand";

import type { Product } from "@/features/products/types/product";
import type { Customer, DocumentType } from "../types/sales";

export type CartItem = {
  product: Product;
  quantity: number;
};

type PosState = {
  items: CartItem[];
  step: 1 | 2;
  customer: Customer | null;
  documentType: DocumentType;
  addProduct: (product: Product) => void;
  increase: (productId: string) => void;
  decrease: (productId: string) => void;
  remove: (productId: string) => void;
  setStep: (step: 1 | 2) => void;
  setCustomer: (customer: Customer | null) => void;
  setDocumentType: (documentType: DocumentType) => void;
  resetSale: () => void;
};

export const usePosStore = create<PosState>((set) => ({
  items: [],
  step: 1,
  customer: null,
  documentType: "03",

  addProduct: (product) =>
    set((state) => {
      const existing = state.items.find((item) => item.product.id === product.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          ),
        };
      }
      return { items: [...state.items, { product, quantity: 1 }] };
    }),

  increase: (productId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
    })),

  decrease: (productId) =>
    set((state) => ({
      items: state.items
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    })),

  remove: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    })),

  setStep: (step) => set({ step }),
  setCustomer: (customer) =>
    set({
      customer,
      documentType: customer?.document_type === "6" ? "01" : "03",
    }),
  setDocumentType: (documentType) => set({ documentType }),
  resetSale: () =>
    set({
      items: [],
      step: 1,
      customer: null,
      documentType: "03",
    }),
}));

import type { Metadata } from "next";
import { Suspense } from "react";
import { Catalog } from "./Catalog";
import { ThumbIndex } from "@/components/ThumbIndex";

export const metadata: Metadata = { title: "Catálogo" };

export default function CatalogPage() {
  return (
    <>
      <ThumbIndex />
      <Suspense>
        <Catalog />
      </Suspense>
    </>
  );
}

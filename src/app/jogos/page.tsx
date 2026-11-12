import type { Metadata } from "next";
import { Suspense } from "react";
import { Catalog } from "./Catalog";

export const metadata: Metadata = { title: "Catálogo" };

export default function CatalogPage() {
  return (
    <>
      <Suspense>
        <Catalog />
      </Suspense>
    </>
  );
}

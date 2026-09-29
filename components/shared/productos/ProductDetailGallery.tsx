"use client";

import { useState } from "react";
import Image from "next/image";
import { getOptimizedCloudinaryUrl } from "@/lib/cloudinary";

type Props = { photos: string[]; name: string };

export function ProductDetailGallery({ photos, name }: Props) {
  const [main, setMain] = useState(0);

  return (
    <div className="space-y-3">
      {/* Main photo */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
        <Image
          src={getOptimizedCloudinaryUrl(photos[main], 1000)}
          alt={name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized
          priority
        />
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setMain(i)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === main ? "border-gray-900" : "border-transparent hover:border-gray-300"
              }`}
            >
              <Image
                src={getOptimizedCloudinaryUrl(url, 400)}
                alt={`${name} ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

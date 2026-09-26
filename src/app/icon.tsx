import { ImageResponse } from "next/og";
import { IconArt } from "@/components/shell/IconArt";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [
    { id: "32", size: { width: 32, height: 32 }, contentType },
    { id: "192", size: { width: 192, height: 192 }, contentType },
    { id: "512", size: { width: 512, height: 512 }, contentType },
    { id: "maskable", size: { width: 512, height: 512 }, contentType }
  ];
}

export default function Icon({ id }: { id: string }) {
  const size = id === "32" ? 32 : id === "192" ? 192 : 512;
  return new ImageResponse(<IconArt size={size} padding={id === "maskable" ? 96 : id === "32" ? 0 : size * 0.06} />, { width: size, height: size });
}

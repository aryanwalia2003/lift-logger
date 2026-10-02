import { ImageResponse } from "next/og";
import { Barbell } from "@/lib/barbell";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<Barbell n={180} />, size);
}

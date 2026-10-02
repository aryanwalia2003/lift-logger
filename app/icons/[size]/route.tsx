import { ImageResponse } from "next/og";
import { Barbell } from "@/lib/barbell";

export const generateStaticParams = () => [{ size: "192" }, { size: "512" }];

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size);
  return new ImageResponse(<Barbell n={n} />, { width: n, height: n });
}

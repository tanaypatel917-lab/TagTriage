import type { Metadata } from "next";
import { RegisterView } from "@/components/register/RegisterView";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return <RegisterView />;
}

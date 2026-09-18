import { LoginForm } from "@/components/login-form";
import { getPageSession } from "@/lib/page-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage() {
  const session = await getPageSession();
  if (session) redirect("/");
  return <LoginForm />;
}

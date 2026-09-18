import { Messenger } from "@/components/messenger";
import { getBootstrap } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function Home() {
  const bootstrap = getBootstrap();
  return <Messenger bootstrap={bootstrap} />;
}

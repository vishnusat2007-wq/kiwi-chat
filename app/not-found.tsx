import { KiwiMark } from "@/components/kiwi-mark";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="kiwi-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <KiwiMark className="h-16 w-16" />
      <h1 className="mt-6 font-display text-3xl text-paper">Thread not found</h1>
      <p className="mt-2 text-sm text-mist">That path isn’t part of Kiwi Chat.</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-kiwi px-4 py-2 text-sm font-semibold text-[#11180f]"
      >
        Back to messenger
      </Link>
    </div>
  );
}

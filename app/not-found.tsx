import { KiwiMark } from "@/components/kiwi-mark";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="kiwi-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="kiwi-halo h-24 w-24">
        <KiwiMark className="relative h-16 w-16" />
      </div>
      <h1 className="mt-8 font-display text-[56px] leading-[0.88] text-paper">
        Not this door.
      </h1>
      <p className="mt-4 max-w-sm text-[16px] leading-7 text-mist">
        That path isn’t part of Kiwi Chat.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="kiwi-btn rounded-full px-6 py-3 text-[15px]">
          Public page
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-line-strong px-6 py-3 text-[15px] font-bold text-paper"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

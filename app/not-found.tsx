import { KiwiMark } from "@/components/kiwi-mark";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="kiwi-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="kiwi-halo h-24 w-24">
        <KiwiMark className="relative h-16 w-16" />
      </div>
      <h1 className="mt-8 font-display text-[48px] leading-none text-paper">
        Thread not found
      </h1>
      <p className="mt-4 max-w-sm text-[16px] leading-7 text-mist">
        That path isn’t part of Kiwi Chat.
      </p>
      <Link
        href="/"
        className="kiwi-btn mt-8 rounded-full px-6 py-3 text-[15px]"
      >
        Back to the room
      </Link>
    </div>
  );
}

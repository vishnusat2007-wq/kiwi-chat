import { KiwiMark } from "@/components/kiwi-mark";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="kiwi-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <KiwiMark className="h-16 w-16" />
      <h1 className="mt-6 font-display text-[40px] leading-none tracking-tight text-paper">
        Thread not found
      </h1>
      <p className="mt-4 max-w-sm text-[15px] leading-7 text-mist">
        That path isn’t part of Kiwi Chat.
      </p>
      <Link
        href="/"
        className="kiwi-btn mt-8 rounded-full px-5 py-2.5 text-sm"
      >
        Back to the room
      </Link>
    </div>
  );
}

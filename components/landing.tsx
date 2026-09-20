import Link from "next/link";
import { KiwiMark } from "@/components/kiwi-mark";

const MOCK = [
  {
    who: "Vishnu’s Grok",
    kind: "bot",
    side: "left",
    color: "vishnu",
    text: "Build is green. Convex is holding the thread now — no more /tmp vanishing act.",
  },
  {
    who: "Friend",
    kind: "human",
    side: "right",
    color: "friend",
    text: "Humans in the same room as the groks. That’s the whole product.",
  },
  {
    who: "Friend’s Grok",
    kind: "bot",
    side: "left",
    color: "friend",
    text: "I’ll keep answering on the HTTP API. You type. I show up.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Issued login.",
    body: "Vishnu hands you a username. There is no create-account page. The room stays small on purpose.",
  },
  {
    n: "02",
    title: "Same thread.",
    body: "You type. The groks answer through bearer tokens. No sidecar, no “bot channel.” One conversation.",
  },
  {
    n: "03",
    title: "It stays.",
    body: "Convex holds conversations, messages, humans, bots, and profiles. Deploy once. The lab is still there tomorrow.",
  },
];

export function Landing({
  signedIn,
  viewerName,
}: {
  signedIn: boolean;
  viewerName?: string;
}) {
  const ctaHref = signedIn ? "/chat" : "/login";
  const ctaLabel = signedIn ? "Open the messenger" : "Sign in";

  return (
    <div className="landing-shell relative min-h-[100dvh] overflow-x-hidden">
      <div className="kiwi-noise" />
      <div className="landing-orb landing-orb-a" />
      <div className="landing-orb landing-orb-b" />

      <header className="relative z-10 mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-6 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <KiwiMark className="h-12 w-12 md:h-14 md:w-14" />
          <span className="font-display text-[28px] leading-none text-paper md:text-[34px]">
            Kiwi Chat
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {signedIn ? (
            <span className="hidden text-[12px] font-extrabold tracking-[0.16em] text-kiwi uppercase sm:inline">
              {viewerName}
            </span>
          ) : (
            <span className="hidden rounded-full border border-line-strong px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-kiwi uppercase sm:inline">
              Invite only
            </span>
          )}
          <Link
            href={ctaHref}
            className="kiwi-btn rounded-full px-5 py-2.5 text-[14px] md:px-6 md:text-[15px]"
          >
            {ctaLabel}
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-[1280px] items-center gap-12 px-5 pt-6 pb-16 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:pt-10 lg:pt-14">
          <div>
            <p className="kiwi-kicker">Private messenger · humans + groks</p>
            <h1 className="landing-hero mt-5 font-display text-[64px] leading-[0.82] text-paper sm:text-[84px] md:text-[96px] lg:text-[112px]">
              Humans type.
              <br />
              Groks answer.
              <br />
              <span className="text-kiwi">Same thread.</span>
            </h1>
            <p className="mt-8 max-w-[34rem] text-[18px] leading-8 text-mist md:text-[20px] md:leading-9">
              Kiwi Chat is the locked room for Vishnu, his friend, and both
              Groks. Bots talk over HTTP. People talk in the UI. Nobody else
              gets a signup form.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href={ctaHref}
                className="kiwi-btn rounded-full px-7 py-4 text-[17px]"
              >
                {ctaLabel}
              </Link>
              <p className="text-[14px] font-bold tracking-wide text-mist uppercase">
                No public create-account
              </p>
            </div>
          </div>

          <div className="landing-preview relative">
            <div className="absolute -top-6 -left-4 hidden rotate-[-8deg] rounded-full bg-kiwi px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] text-[#11180f] uppercase md:block">
              Live lab
            </div>
            <div className="kiwi-frame overflow-hidden rounded-[32px] p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="kiwi-kicker">Thread</p>
                  <p className="mt-1 font-display text-[36px] leading-none text-paper">
                    Kiwi Lab
                  </p>
                </div>
                <span className="flex items-center gap-2 rounded-full bg-kiwi px-3 py-1.5 text-[11px] font-extrabold tracking-[0.14em] text-[#11180f] uppercase">
                  <span className="live-dot h-2 w-2 rounded-full bg-[#11180f]" />
                  Live
                </span>
              </div>
              <ol className="space-y-3">
                {MOCK.map((line, index) => (
                  <li
                    key={line.text}
                    className={`landing-bubble flex ${
                      line.side === "right" ? "justify-end" : "justify-start"
                    }`}
                    style={{ animationDelay: `${160 + index * 140}ms` }}
                  >
                    <div
                      className={`max-w-[92%] rounded-[22px] px-4 py-3 ${
                        line.side === "right" ? "bubble-right" : "bubble-left"
                      }`}
                      style={{
                        background:
                          line.color === "friend"
                            ? "linear-gradient(180deg, rgba(212,184,255,0.28), rgba(42,24,64,0.94))"
                            : "linear-gradient(180deg, rgba(198,241,85,0.22), rgba(20,40,16,0.96))",
                      }}
                    >
                      <p className="text-[11px] font-extrabold tracking-[0.14em] text-kiwi uppercase">
                        {line.who}
                        {line.kind === "bot" ? " · bot" : ""}
                      </p>
                      <p className="mt-1 text-[15px] leading-6 text-paper">
                        {line.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-bg-1/70">
          <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-5 py-16 md:grid-cols-3 md:px-8 md:py-20">
            {STEPS.map((step) => (
              <article key={step.n}>
                <p className="font-display text-[48px] leading-none text-kiwi">
                  {step.n}
                </p>
                <h2 className="mt-4 font-display text-[36px] leading-[0.92] text-paper">
                  {step.title}
                </h2>
                <p className="mt-4 text-[16px] leading-7 text-mist">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1280px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
            <div>
              <p className="kiwi-kicker">Who’s in the room</p>
              <h2 className="mt-4 font-display text-[56px] leading-[0.86] text-paper md:text-[72px]">
                Two humans.
                <br />
                Two groks.
                <br />
                One lab.
              </h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { name: "Vishnu", role: "Human · issued login", tone: "vishnu" },
                { name: "Friend", role: "Human · issued login", tone: "friend" },
                { name: "Vishnu’s Grok", role: "Bot · HTTP bearer", tone: "vishnu" },
                { name: "Friend’s Grok", role: "Bot · HTTP bearer", tone: "friend" },
              ].map((person) => (
                <li
                  key={person.name}
                  className="rounded-[28px] border border-line bg-bg-1 px-5 py-5"
                >
                  <p
                    className={`text-[12px] font-extrabold tracking-[0.16em] uppercase ${
                      person.tone === "friend" ? "text-friend" : "text-kiwi"
                    }`}
                  >
                    {person.role}
                  </p>
                  <p className="mt-2 font-display text-[32px] leading-none text-paper">
                    {person.name}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8">
          <div className="kiwi-panel relative mx-auto max-w-[1280px] overflow-hidden rounded-[40px] px-8 py-12 md:px-14 md:py-16">
            <span className="kiwi-panel-accent" />
            <p className="kiwi-kicker">Not a signup factory</p>
            <h2 className="mt-4 max-w-[16ch] font-display text-[52px] leading-[0.86] text-paper md:text-[72px]">
              If you don’t have a login, you don’t get in.
            </h2>
            <p className="mt-6 max-w-[36rem] text-[18px] leading-8 text-mist">
              Kiwi Chat is not recruiting the internet. Vishnu issues two
              logins. The groks already have tokens. The public page is just
              the front door.
            </p>
            <Link
              href={ctaHref}
              className="kiwi-btn mt-8 inline-flex rounded-full px-7 py-4 text-[17px]"
            >
              {ctaLabel}
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line px-5 py-8 text-center text-[13px] text-mist md:px-8">
        Kiwi Chat · private messenger · Convex persistence · no public signup
      </footer>
    </div>
  );
}

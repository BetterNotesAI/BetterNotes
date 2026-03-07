import Link from "next/link";

type NavbarProps = {
  isLoggedIn: boolean;
};

export function Navbar({ isLoggedIn }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/50 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-wide text-white/90">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/20 bg-white/10 text-xs">B</span>
          BetterNotes
        </Link>
        <nav className="flex items-center gap-5 text-sm text-white/70">
          <Link href="/workspace" className="transition hover:text-white">
            Workspace
          </Link>
          <Link href="/templates" className="transition hover:text-white">
            Templates
          </Link>
          <Link href="/pricing" className="transition hover:text-white">
            Pricing
          </Link>
          {isLoggedIn ? (
            <Link
              href="/billing"
              className="rounded-full border border-white/20 px-4 py-1.5 text-white transition hover:border-white/40"
            >
              Billing
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-white/20 px-4 py-1.5 text-white transition hover:border-white/40"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

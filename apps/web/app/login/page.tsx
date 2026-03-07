import Link from "next/link";
import { AuthPanel } from "../../components/auth-panel";

export default function LoginPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="space-y-4 text-center">
        <AuthPanel mode="login" />
        <p className="text-sm text-white/60">
          No account yet?{" "}
          <Link href="/signup" className="text-mint transition hover:text-mint/80">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { AuthPanel } from "../../components/auth-panel";

export default function SignupPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="space-y-4 text-center">
        <AuthPanel mode="signup" />
        <p className="text-sm text-white/60">
          Already registered?{" "}
          <Link href="/login" className="text-mint transition hover:text-mint/80">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication.
// NOTE: /workspace is intentionally NOT protected — the freemium flow handles
// auth internally, allowing anonymous users to try one free message.
const protectedRoutes: string[] = [];

// Auth pages: redirect to /workspace if the user is already signed in.
const authRoutes = ["/login", "/signup"];

export default async function middleware(req: NextRequest) {
    let res = NextResponse.next({
        request: { headers: req.headers },
    });

    // Create a Supabase client that can read/write cookies on the request/response.
    // This is what keeps the Supabase session alive across navigations.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return req.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        req.cookies.set(name, value);
                    });
                    res = NextResponse.next({
                        request: { headers: req.headers },
                    });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        res.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // getUser() (not getSession()) so Supabase can refresh expired access tokens
    // and write the updated cookies back on every navigation.
    const { data: { user } } = await supabase.auth.getUser();

    const path = req.nextUrl.pathname;
    const isAuthenticated = Boolean(user);

    // Redirect unauthenticated users away from protected routes
    if (!isAuthenticated && protectedRoutes.some((route) => path.startsWith(route))) {
        const redirectUrl = new URL("/login", req.url);
        redirectUrl.searchParams.set("redirect", path);
        return NextResponse.redirect(redirectUrl);
    }

    // Redirect authenticated users away from login/signup
    if (isAuthenticated && authRoutes.includes(path)) {
        return NextResponse.redirect(new URL("/workspace", req.url));
    }

    return res;
}

export const config = {
    matcher: [
        // Run on all app routes so Supabase can refresh session cookies.
        // Skip static assets and Next.js internals.
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};

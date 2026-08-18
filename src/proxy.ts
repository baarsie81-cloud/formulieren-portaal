import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const clerkIsConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

function isApiRoute(request: NextRequest) {
  return request.nextUrl.pathname === "/api" || request.nextUrl.pathname.startsWith("/api/");
}

const clerkProxy = clerkMiddleware(async (auth, request) => {
  if (isApiRoute(request)) {
    await auth.protect();
  }
});

export default clerkIsConfigured
  ? clerkProxy
  : function proxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

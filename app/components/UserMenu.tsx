"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div className="w-8 h-8 rounded-full bg-orange-100 animate-pulse" />;

  if (!session)
    return (
      <div className="flex gap-1.5 shrink-0">
        <Link
          href="/login"
          className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition"
        >
          Sign Up
        </Link>
      </div>
    );

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold uppercase shrink-0">
          {session.user?.name?.[0] ?? "U"}
        </div>
        <span className="text-sm font-medium text-gray-700 hidden md:block">
          {session.user?.name}
        </span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="px-2 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
      >
        Logout
      </button>
    </div>
  );
}

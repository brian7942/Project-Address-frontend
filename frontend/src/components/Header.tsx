"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
];

const LOGO_SRC = "/project-address-logo.png";
const LOGO_ALT = "Project:Address";
const BRAND_ORANGE = "#F97316";

export default function Header() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName?.toLowerCase();
        const editable = el?.getAttribute?.("contenteditable") === "true";
        if (tag === "input" || tag === "textarea" || tag === "select" || editable) return;
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") inputRef.current?.blur();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const headerClass = "bg-white/95 backdrop-blur text-gray-900 shadow";
  const navLinkBase =
    "rounded-md px-2 py-1 sm:px-3 sm:py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2";
  const navLink = (active: boolean) =>
    [
      navLinkBase,
      active
        ? "bg-[var(--brand-orange,_#F97316)] text-white focus-visible:ring-orange-300"
        : "hover:bg-gray-100 text-gray-700 hover:text-[var(--brand-orange,_#F97316)] focus-visible:ring-gray-300",
    ].join(" ");

  const inputClass =
    "h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-8 text-xs sm:text-sm placeholder:text-gray-400 " +
    "shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange,_#F97316)] focus:border-[var(--brand-orange,_#F97316)] " +
    "caret-[var(--brand-orange,_#F97316)]";

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 h-14 ${headerClass}`}>
      <div className="mx-auto flex h-14 max-w-none items-center gap-2 pl-4 pr-1 sm:gap-4 sm:pl-4 sm:pr-2 md:pr-10">
        {/* 로고 */}
        <Link
          id="app-logo"  // ✅ page.tsx에서 이 id로 클릭을 감지해 전체 초기화
          href="/"
          aria-label="Go to Project:Address home"
          className="ml-2 sm:ml-4 md:ml-6 lg:ml-10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
        >
          <span className="inline-flex items-center gap-2">
            <Image
              src={LOGO_SRC}
              alt={LOGO_ALT}
              width={170}
              height={32}
              priority
              sizes="(max-width: 640px) 170px, (max-width: 768px) 150px, 170px"
              className="h-8 w-auto md:h-9"
            />
          </span>
          <span className="sr-only">Project:Address</span>
        </Link>

        {/* 검색 + 버튼 */}
        <form onSubmit={onSubmit} role="search" className="flex-1 min-w-0 flex justify-center">
          <div className="flex w-full max-w-[16rem] sm:max-w-[20rem] md:max-w-[26rem] items-stretch">
            <div className="relative flex-1">
              <label htmlFor="site-search" className="sr-only">Search</label>
              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center pl-1">
                <Search className="h-4 w-4 text-gray-400" aria-hidden={true} />
              </span>
              <input
                id="site-search"
                ref={inputRef}
                type="search"
                inputMode="search"
                autoComplete="off"
                placeholder="Search address…"
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(""); inputRef.current?.focus(); }}
                  className="absolute inset-y-0 right-2 flex items-center"
                  aria-label="Clear search"
                  title="Clear"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" aria-hidden={true} />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="ml-2 h-9 px-3 inline-flex items-center justify-center rounded-md bg-[var(--brand-orange,_#F97316)] text-white text-xs sm:text-sm shadow-sm hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              aria-label="Search"
              title="Search"
            >
              <Search className="h-4 w-4 mr-0 sm:mr-1" aria-hidden={true} />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </form>

        {/* 내비 — 오른쪽 고정 */}
        <nav className="ml-auto mr-0 flex items-center justify-end gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap shrink-0">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={navLink(active)}
                aria-current={active ? "page" : undefined}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <style jsx global>{`
        :root { --brand-orange: ${BRAND_ORANGE}; }
      `}</style>
    </header>
  );
}

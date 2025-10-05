import Header from "@/components/Header";

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? "";
  return (
    <>
      <Header />
      <main className="pt-14">
        <section className="mx-auto max-w-screen-xl px-4 py-8">
          <h1 className="text-2xl font-semibold">Search</h1>
          <p className="mt-2 text-gray-600">
            Query: <span className="font-mono">{q}</span>
          </p>
          {/* TODO: 실제 검색 결과를 여기에 렌더링 */}
        </section>
      </main>
    </>
  );
}

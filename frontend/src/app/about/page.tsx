// app/about/page.tsx
import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "About – Project:Address",
  description: "Learn about the Project:Address vision and technology.",
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="pt-14">
        <section className="mx-auto max-w-screen-lg px-4 py-10">
          {/* subtle EUSYN attribution */}
          <p className="text-xs text-gray-500">
            <span className="inline-block rounded-full bg-gray-100 px-2 py-1">
              A project by{" "}
              <a
                href="https://eusyn.co"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted hover:text-gray-700"
                title="Visit EUSYN"
              >
                EUSYN
              </a>
            </span>
          </p>

          <h1 className="mt-3 text-3xl font-bold">About Project:Address</h1>
          <p className="mt-3 text-gray-700">
            Project:Address is an AI-powered digital addressing system for regions with
            limited or inconsistent address infrastructure. We combine official administrative
            boundaries with OpenStreetMap buildings and roads to algorithmically generate
            block and building numbers, then assemble them into consistent, human-readable
            addresses.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border p-5">
              <h2 className="text-xl font-semibold">How it works</h2>
              <ul className="mt-3 list-disc pl-5 text-gray-700 space-y-1">
                <li>Scoped loading by administrative unit (Country → State/Province → City → Village)</li>
                <li>Automatic block generation using road network and density heuristics</li>
                <li>Hybrid numbering: grid-first with road-aware adjustments</li>
                <li>Deterministic address strings with conflict-free rules</li>
              </ul>
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-xl font-semibold">Tech Stack</h2>
              <ul className="mt-3 list-disc pl-5 text-gray-700 space-y-1">
                <li>Frontend: Next.js, React, Tailwind, Leaflet</li>
                <li>Backend: FastAPI</li>
                <li>Database & GIS: PostgreSQL + PostGIS</li>
                <li>Data Sources: OpenStreetMap + official administrative boundaries</li>
                <li>AI: rules to start, learning-based over time</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 rounded-lg border p-5">
            <h2 className="text-xl font-semibold">Roadmap</h2>
            <ol className="mt-3 list-decimal pl-5 text-gray-700 space-y-1">
              <li>MVP across select provinces in Laos and Cambodia</li>
              <li>Stabilize hybrid numbering and ensure no duplicates</li>
              <li>Improve AI ordering and generation with user feedback</li>
              <li>Expose APIs and Data Studio with commercial licensing</li>
            </ol>
          </div>

          {/* subtle footer note with EUSYN link (second gentle hint) */}
          <p className="mt-8 text-sm text-gray-500">
            Built with care by{" "}
            <a
              href="https://eusyn.co"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-gray-700"
            >
              EUSYN
            </a>
            .
          </p>
        </section>
      </main>
    </>
  );
}

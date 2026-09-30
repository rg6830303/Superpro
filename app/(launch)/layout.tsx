import { Suspense } from "react";
import { BootCover } from "@/components/boot-cover";
import { SmashIntro } from "@/components/smash-intro";

/**
 * The main domain's front door: the intro film, then the coming-soon page.
 * No site header or footer — the launch stands on its own.
 */
export default function LaunchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BootCover />
      <div data-site-content>{children}</div>
      {/* Reads the `welcome` query param, so it needs a suspense boundary. */}
      <Suspense fallback={null}>
        <SmashIntro />
      </Suspense>
    </>
  );
}

import type { Metadata } from "next";
import { pageMetadata, pages } from "@/lib/site";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import s from "@/components/ventures/ventures.module.css";
import { getVenture, ventures, type Venture } from "@/components/ventures/data";
import VentureVisual from "@/components/ventures/VentureVisual";
import JsonLd from "@/components/seo/JsonLd";
import { ventureGraph } from "@/lib/schema";

export function generateStaticParams() {
  return ventures.map((v) => ({ slug: v.slug }));
}

/** Search and social metadata for one venture's page. */
function ventureSeo(v: Venture) {
  return {
    path: `/ventures/${v.slug}`,
    title: `${v.name} — ${v.category} | SODWORKS`,
    description: v.summary,
    image: v.images
      ? { url: `/og/ventures/${v.slug}.jpg`, width: 1200, height: 630, alt: `${v.name} — ${v.images[0].alt}` }
      : v.logo
        ? { url: `/og/ventures/${v.slug}.jpg`, width: 1200, height: 630, alt: v.logo.alt }
        : pages.ventures.image,
  };
}

export async function generateMetadata({ params }: PageProps<"/ventures/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const v = getVenture(slug);
  if (!v) return {};
  return pageMetadata(ventureSeo(v));
}

/**
 * A venture's project page. Sections render only when they have content:
 * nothing here is inferred beyond the supplied brief.
 *
 * The page shell doesn't depend on the URL; the slug is read inside
 * <Suspense> (Cache Components). Every slug is prerendered, so the fallback —
 * a quiet black shell — is essentially never seen.
 */
export default function VenturePage({ params }: PageProps<"/ventures/[slug]">) {
  return (
    <Suspense fallback={<main className={`${s.page} ${s.detail} ${s.detailFallback}`} aria-busy="true" />}>
      <VentureDetail params={params} />
    </Suspense>
  );
}

async function VentureDetail({ params }: { params: PageProps<"/ventures/[slug]">["params"] }) {
  const { slug } = await params;
  const v = getVenture(slug);
  if (!v) notFound();

  const i = ventures.indexOf(v);
  const next = ventures[(i + 1) % ventures.length];
  const total = String(ventures.length).padStart(2, "0");
  const live = v.status === "live";
  const host = v.website ? new URL(v.website).hostname.replace(/^www\./, "") : null;

  return (
    <main id="main" className={`${s.page} ${s.detail} ${s[`tone_${v.tone}`]}`}>
      <JsonLd data={ventureGraph(ventureSeo(v), v)} />
      <div className={s.wrap}>
        <Link href={`/ventures#venture-${v.slug}`} className={s.back}>
          <span aria-hidden="true">←</span> The venture collection
        </Link>

        <header className={s.detailHead}>
          <p className={s.identifier}>
            <span className={s.identifierRule} aria-hidden="true" />
            Venture {v.index} / {total} · {v.category}
            {v.location && <> · {v.location}</>}
          </p>
          <h1 className={s.detailTitle}>
            {v.nameLines.map((line) => (
              <span key={line} className={s.lineMask}>
                <span className={`sw-tiles ${s.detailLine}`}>{line}</span>
              </span>
            ))}
          </h1>
          <div className={s.detailMeta}>
            <span className={`${s.statusPill} ${live ? s.statusLive : ""}`}>
              {live ? "Live" : "In development"}
            </span>
            {v.website && host && (
              <a className={s.explore} href={v.website} target="_blank" rel="noopener noreferrer">
                Visit {host} <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </header>

        <div className={s.detailStage}>
          <VentureVisual
            venture={v}
            sizes={{ primary: "(max-width: 899px) 92vw, 60vw", secondary: "(max-width: 899px) 50vw, 32vw" }}
            preload
          />
        </div>

        <div className={s.detailGrid}>
          <section className={s.detailBlock} aria-labelledby="overview">
            <h2 id="overview" className={s.blockTitle}>
              Overview
            </h2>
            <p>{v.description}</p>
          </section>

          <section className={s.detailBlock} aria-labelledby="objectives">
            <h2 id="objectives" className={s.blockTitle}>
              Objectives
            </h2>
            <ul className={s.objectives}>
              {v.objectives.map((o, k) => (
                <li key={o}>
                  <span className={s.capKey}>{String.fromCharCode(97 + k)}.</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={s.detailBlock} aria-labelledby="built">
            <h2 id="built" className={s.blockTitle}>
              {live ? "What SODWORKS built" : "What SODWORKS is building"}
            </h2>
            <p>{v.scope}</p>
            {!live && (
              <p className={s.devNote}>
                Development is ongoing. This page will be updated with project imagery and details as the work
                progresses{v.logo ? "." : "; the illustration above is a concept study, not the project."}
              </p>
            )}
          </section>
        </div>

        {v.images && (
          <section className={s.gallery} aria-labelledby="imagery">
            <h2 id="imagery" className={s.blockTitle}>
              Imagery
            </h2>
            <div className={s.galleryGrid} data-count={v.images.length + (v.gallery?.length ?? 0)}>
              {[...v.images, ...(v.gallery ?? [])].map((img, k) => (
                <figure
                  key={img.src}
                  className={s.galleryItem}
                  style={{ aspectRatio: `${img.width} / ${img.height}` }}
                >
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes={
                      k === 0 && (v.images?.length ?? 0) + (v.gallery?.length ?? 0) === 3
                        ? "(max-width: 899px) 92vw, min(1280px, 92vw)"
                        : "(max-width: 899px) 92vw, 45vw"
                    }
                    className={s.img}
                  />
                  <figcaption>
                    Fig. {v.index}
                    {String.fromCharCode(97 + k)} — {img.alt}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {v.website && host && (
          <section className={s.visit} aria-label="Official website">
            <p className={s.visitLabel}>Official website</p>
            <a
              className={s.visitLink}
              href={v.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ "--chars": host.length } as CSSProperties}
            >
              <span className="sw-tiles">{host}</span>
              <span className={s.visitArrow} aria-hidden="true">
                ↗
              </span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </section>
        )}

        <nav className={s.nextVenture} aria-label="Next venture">
          <span className={s.identifier}>Next venture</span>
          <Link href={`/ventures/${next.slug}`} className={s.nextLink}>
            <span className={s.nextNo}>{next.index}</span>
            <span className={s.nextName}>{next.name}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </div>
    </main>
  );
}

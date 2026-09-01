import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site/SiteHeader";
import { TypographicField } from "@/components/typographic-field/TypographicField";
import lionMark from "@/logos/79eef03d-4ddc-47a4-a17b-f4d0e13e7fa6.png";
import styles from "./home.module.css";
import { featuredPublications } from "@/lib/publications";

export default async function Page() {
  const headlines = await featuredPublications();
  return (
    <main className={styles.page} data-home-scroll>
      <SiteHeader />

      <section className={styles.hero} aria-labelledby="home-wordmark">
        <div className={styles.fallbackField} aria-hidden="true" />
        <TypographicField
          canvasClassName={styles.matrixCanvas}
          statusClassName={styles.engineStatus}
          dotClassName={styles.statusDot}
        />

        <div className={styles.brandCenter}>
          <div className={styles.brandMark} aria-hidden="true">
            <Image
              src={lionMark}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 190px, 260px"
            />
          </div>
          <h1 id="home-wordmark" className={styles.wordmark}>LIONSOFZION</h1>
          <span className={styles.signalMarker} aria-hidden="true" />
          <Link href="/information-war" className={styles.heroCta}>
            Discover our system
          </Link>
          <p className={styles.supportingLine}>Powered by evidence, not narratives.</p>
        </div>
        {headlines.length ? (
          <aside className={styles.headlineRail} aria-label="Leading reports">
            <p>FROM THE INTELLIGENCE DESK</p>
            <ol>
              {headlines.slice(0, 3).map((headline, index) => (
                <li key={headline.publicId}>
                  <Link href={`/articles/${headline.publicId}`}>
                    <span>0{index + 1}</span>
                    <strong>{headline.title}</strong>
                  </Link>
                </li>
              ))}
            </ol>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

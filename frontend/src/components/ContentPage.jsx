import AdSenseUnit from "./AdSenseUnit.jsx";

export default function ContentPage({ title, children, showTopAd = false, hero }) {
  return (
    <article className={`content-page${hero ? " content-page--with-hero" : ""}`}>
      {showTopAd ? <AdSenseUnit className="adsense-top" /> : null}
      {hero ? (
        <section className="page-hero">
          <div className="page-hero__text">
            <h1>{title}</h1>
            {hero.lead ? <p>{hero.lead}</p> : null}
            {hero.actions ? <div className="hero-cta">{hero.actions}</div> : null}
          </div>
          {hero.image ? (
            <img
              src={hero.image}
              alt={hero.imageAlt || ""}
              className="page-hero__image"
              width={800}
              height={400}
              loading="eager"
            />
          ) : null}
        </section>
      ) : (
        <h1>{title}</h1>
      )}
      <div className="content-prose">{children}</div>
    </article>
  );
}


"use client";

import { useState } from "react";

type Language = "en" | "ar";

const translations = {
  en: {
    home: "Home",
    communities: "Communities",
    firstLove: "FirstLove",
    login: "Log in",
    join: "Join Memories",
    eyebrow: "YOUR STORIES DESERVE TO LIVE ON",
    heading1: "Some memories",
    heading2: "never fade.",
    description:
      "Reconnect with the places, people, and moments that shaped your life. Your school days, university friendships, and unforgettable stories all have a home here.",
    explore: "Explore Memories",
    start: "Start Your Journey",
    sectionLabel: "A PLACE FOR EVERY MEMORY",
    sectionTitle: "Where your stories come alive",
    schoolTitle: "School Memories",
    schoolText:
      "Remember your classmates, teachers, and the moments that made school unforgettable.",
    universityTitle: "University Memories",
    universityText:
      "Rediscover campus life, old friendships, and the experiences that shaped your future.",
    loveTitle: "FirstLove",
    loveText:
      "A private space to remember your first love, built around privacy and mutual consent.",
    discover: "Discover More",
    closingTitle: "Every memory has a story.",
    closingText:
      "And every story deserves a place to be remembered.",
    footer: "Memories — Keep the moments that matter.",
    comingSoon: "Coming soon",
  },
  ar: {
    home: "الرئيسية",
    communities: "المجتمعات",
    firstLove: "الحب الأول",
    login: "تسجيل الدخول",
    join: "انضم إلى ذكريات",
    eyebrow: "لأن ذكرياتك تستحق أن تبقى",
    heading1: "بعض الذكريات",
    heading2: "لا تغيب أبدًا.",
    description:
      "عد إلى الأماكن والأشخاص واللحظات التي صنعت أجمل أيامك. ذكريات المدرسة، وصداقات الجامعة، والحكايات التي لا تُنسى، كلها تجد مكانها هنا.",
    explore: "اكتشف الذكريات",
    start: "ابدأ رحلتك",
    sectionLabel: "لكل ذكرى مكان",
    sectionTitle: "هنا تعود الحكايات إلى الحياة",
    schoolTitle: "ذكريات المدرسة",
    schoolText:
      "استعد أيام الدراسة ورفاق الصف والمعلمين والمواقف التي ما زالت تعيش في ذاكرتك.",
    universityTitle: "ذكريات الجامعة",
    universityText:
      "استرجع أيام الجامعة وصداقات العمر واللحظات التي صنعت مستقبلك.",
    loveTitle: "الحب الأول",
    loveText:
      "مساحة خاصة لاستعادة ذكرى الحب الأول، مع احترام الخصوصية والموافقة المتبادلة.",
    discover: "اكتشف المزيد",
    closingTitle: "لكل ذكرى حكاية.",
    closingText: "ولكل حكاية مكان تستحق أن تبقى فيه.",
    footer: "ذكريات — لأن اللحظات الجميلة تستحق البقاء.",
    comingSoon: "قريبًا",
  },
};

export default function Home() {
  const [language, setLanguage] = useState<Language>("ar");
  const t = translations[language];
  const isArabic = language === "ar";

  function showComingSoon() {
    window.alert(
      isArabic
        ? "هذه الميزة ستكون متاحة قريبًا."
        : "This feature is coming soon."
    );
  }

  return (
    <main
      className={`site ${isArabic ? "arabic" : "english"}`}
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
    >
      <header className="site-header">
        <div className="container nav-content">
          <a className="brand" href="/">
            <span className="brand-symbol">✦</span>
            <span>
              <strong>Memories</strong>
              <small>ذكريات</small>
            </span>
          </a>

          <nav className="desktop-nav">
            <a href="#home">{t.home}</a>
            <a href="#communities">{t.communities}</a>
            <a href="#firstlove">{t.firstLove}</a>
          </nav>

          <div className="nav-actions">
            <button
              className="language-button"
              onClick={() =>
                setLanguage(language === "ar" ? "en" : "ar")
              }
              aria-label="Switch language"
            >
              {isArabic ? "English" : "العربية"}
            </button>
            <button
              className="button button-outline desktop-action"
              onClick={showComingSoon}
            >
              {t.login}
            </button>
            <button
              className="button button-primary desktop-action"
              onClick={showComingSoon}
            >
              {t.join}
            </button>
          </div>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="container hero-content">
          <div className="hero-copy">
            <span className="eyebrow">{t.eyebrow}</span>

            <h1>
              {t.heading1}
              <span>{t.heading2}</span>
            </h1>

            <p>{t.description}</p>

            <div className="hero-actions">
              <button
                className="button button-primary button-large"
                onClick={showComingSoon}
              >
                {t.start}
              </button>
              <a
                className="button button-outline button-large"
                href="#communities"
              >
                {t.explore}
              </a>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="photo-frame photo-back">
              <div className="photo-scene scene-school">
                <span>1989</span>
              </div>
            </div>

            <div className="photo-frame photo-front">
              <div className="photo-scene scene-sunset">
                <span>Memories ♡</span>
              </div>
            </div>

            <div className="memory-note">
              <span>✦</span>
              <p>
                {isArabic
                  ? "أجمل الأيام تبقى معنا"
                  : "The best days stay with us"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="communities-section" id="communities">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">{t.sectionLabel}</span>
            <h2>{t.sectionTitle}</h2>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon school-icon">🎒</div>
              <h3>{t.schoolTitle}</h3>
              <p>{t.schoolText}</p>
              <button onClick={showComingSoon}>
                {t.discover} <span>↗</span>
              </button>
            </article>

            <article className="feature-card">
              <div className="feature-icon university-icon">🎓</div>
              <h3>{t.universityTitle}</h3>
              <p>{t.universityText}</p>
              <button onClick={showComingSoon}>
                {t.discover} <span>↗</span>
              </button>
            </article>

            <article className="feature-card" id="firstlove">
              <div className="feature-icon love-icon">♡</div>
              <h3>{t.loveTitle}</h3>
              <p>{t.loveText}</p>
              <button onClick={showComingSoon}>
                {t.discover} <span>↗</span>
              </button>
            </article>
          </div>
        </div>
      </section>

      <section className="closing-section">
        <div className="container">
          <div className="closing-content">
            <span className="closing-symbol">✦</span>
            <h2>{t.closingTitle}</h2>
            <p>{t.closingText}</p>
            <button
              className="button button-primary button-large"
              onClick={showComingSoon}
            >
              {t.join}
            </button>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-content">
          <strong>Memories | ذكريات</strong>
          <span>{t.footer}</span>
<small>© 2026 Memories</small>
        </div>
      </footer>
    </main>
  );
}

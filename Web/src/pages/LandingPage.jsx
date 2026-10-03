// File: LandingPage.jsx
// Purpose: Public marketing home at /.

import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Our Vision', href: '#vision' },
];

const ABOUT_LEAD = 'Built so local communities can trade';
const ABOUT_TAIL =
  'energy directly with each other, with every rule enforced centrally and verified before it ever reaches a client.';

const CORE_SOLUTIONS = [
  {
    key: 'reservations',
    kind: 'photo',
    title: 'Scheduled Solar Trading',
    body: 'Solar prosumers reserve a battery injection slot up to 7 days ahead, right from the mobile app — no walk-up guesswork.',
  },
  {
    key: 'telemetry',
    kind: 'light',
    title: 'Live Station Network',
    body: 'Every microgrid node reports its operating hours, battery capacity, and open slots straight from the central service — never hardcoded, never stale.',
  },
  {
    key: 'window',
    kind: 'metric',
    metric: '12h',
    metricLabel: 'Minimum Notice Window',
    title: 'Flexible, Not Fragile',
    body: 'Reservations can be changed or cancelled free of charge up to 12 hours before the slot — enforced centrally, the same for every client.',
  },
];

const ROLES = [
  {
    key: 'prosumer',
    icon: 'solar_power',
    tag: 'Mobile',
    title: 'Solar Prosumers',
    body: 'Register with your NIC, reserve or modify energy slots, and receive a verifiable QR pass the moment a booking is approved.',
  },
  {
    key: 'operator',
    icon: 'qr_code_scanner',
    tag: 'Web + Mobile',
    title: 'Grid Operators',
    body: 'Keep battery-slot availability current, review incoming reservations, and scan a prosumer’s pass to verify and finalize the transfer.',
  },
  {
    key: 'backoffice',
    icon: 'admin_panel_settings',
    tag: 'Web',
    title: 'Backoffice Administrators',
    body: 'Register microgrid nodes, maintain their schedules, and manage every account across the network from one console.',
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    icon: 'event_available',
    title: 'Find & Schedule',
    body: 'Locate a nearby microgrid station and reserve an injection slot up to 7 calendar days ahead.',
    footnote: '7-Day Advance Booking',
  },
  {
    number: '02',
    icon: 'fact_check',
    title: 'Operator Review',
    body: 'A Grid Operator confirms the reservation is ready to be honored at the station.',
    footnote: 'Central Approval',
  },
  {
    number: '03',
    icon: 'verified',
    title: 'Scan & Settle',
    body: 'Arrive at the hub, the operator verifies your pass against live server data, and the transfer finalizes on the spot.',
    footnote: 'Server-Verified Transfer',
  },
];

const CAPABILITIES = [
  'Role-based access for Prosumers, Grid Operators, and Backoffice',
  'QR passes verified against live server data, never trusted from the device alone',
  'Every business rule enforced once, centrally — not duplicated per client',
];

const FOOTER_LINKS = {
  Platform: [
    { label: 'About', href: '#about' },
    { label: 'Core Solutions', href: '#solutions' },
  ],
  Network: [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Our Vision', href: '#vision' },
  ],
};

// Splits a sentence into word-level spans so a scrubbed ScrollTrigger can wash the
// line in one word at a time. Words stay whole rather than split per character, so
// selection, in-page search and screen readers still see ordinary words.
function Words({ text }) {
  return text.split(' ').map((word, index) => (
    <span key={`${word}-${index}`} className="js-word inline-block">
      {word}
      {' '}
    </span>
  ));
}

export default function LandingPage() {
  const navigate = useNavigate();
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context((self) => {
      const mm = gsap.matchMedia();

      // Full motion — a critically-damped ease-out by default (no overshoot on a scripted,
      // non-gesture entrance), reserved for the two moments that carry real emphasis: the
      // hero wordmark settling into place, and hover feedback on primary actions.
      // Everything scroll-linked below uses ease: 'none', which is what keeps a scrubbed
      // tween in exact 1:1 sync with the scroll position.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero entrance: the giant wordmark, then the tagline row. The nav sits inside
        // the hero and is deliberately left alone — it scrolls away with the hero rather
        // than following the reader down the page.
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from('.js-wordmark', { opacity: 0, y: 24, scale: 0.97, duration: 0.9 })
          .from('.js-hero-tagline', { y: 16, opacity: 0, duration: 0.6 }, '-=0.45')
          .from('.js-hero-sub', { y: 16, opacity: 0, duration: 0.5 }, '-=0.4');

        // Hero: held in place for just over half a screen while the photograph pushes in
        // and the centre wordmark drifts up and out. Only the wordmark leaves — the nav and
        // the tagline row stay legible over the photograph for the whole pin.
        //
        // The pin is applied to the padded wrapper, never to anything being animated —
        // ScrollTrigger needs to own the pinned element's transform outright. For the same
        // reason the scroll tween targets the .js-hero-center wrapper while the entrance
        // above targets its child: two tweens fighting over one element's opacity would
        // otherwise capture each other's mid-flight values as their start state.
        gsap.set('.js-hero-img', { yPercent: -12, transformOrigin: '50% 50%' });

        gsap
          .timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: '.js-hero-wrap',
              start: 'top top',
              end: '+=65%',
              pin: true,
              scrub: 1,
              anticipatePin: 1,
            },
          })
          .to('.js-hero-img', { yPercent: -4, scale: 1.18 }, 0)
          .to('.js-hero-center', { yPercent: -18, scale: 1.12, opacity: 0 }, 0);

        // About: the sentence is washed in a word at a time against its own faded self.
        //
        // The section is pinned for the length of the wash. A scrubbed tween runs at
        // whatever speed the wheel does, so without the pin a quick flick simply carried
        // the whole statement off screen before it had finished arriving — slowing the
        // tween cannot fix that, because the text is already gone. Pinned, the page holds
        // still until the sentence has landed, and the scroll it takes to get there is set
        // by ABOUT_HOLD below.
        //
        // The trailing empty tween is a deliberate pause: it spends the last fifth of the
        // pin on nothing at all, so the completed sentence sits there legible for a beat
        // before the section releases.
        const ABOUT_HOLD = '+=110%';

        gsap
          .timeline({
            scrollTrigger: {
              trigger: '#about',
              start: 'top top',
              end: ABOUT_HOLD,
              pin: true,
              scrub: 0.8,
              anticipatePin: 1,
            },
          })
          .fromTo(
            '.js-word',
            { opacity: 0.16 },
            { opacity: 1, ease: 'none', duration: 0.6, stagger: 0.4 }
          )
          .to({}, { duration: 2.6 });

        // Solution cards rise together as the row enters, and the photo card's image
        // drifts against its own frame for depth.
        gsap.set('.js-solution-card', { opacity: 0, y: 32 });
        ScrollTrigger.batch('.js-solution-card', {
          start: 'top 88%',
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'power3.out',
              stagger: 0.12,
              overwrite: true,
            }),
        });

        gsap.fromTo(
          '.js-solution-photo',
          { yPercent: -8 },
          {
            yPercent: 8,
            ease: 'none',
            scrollTrigger: { trigger: '.js-solution-photo', start: 'top bottom', end: 'bottom top', scrub: true },
          }
        );

        // How it works: the section is held still and vertical scroll is remapped onto
        // horizontal travel, so the three stages arrive in the order they happen in rather
        // than sitting side by side all at once. The track is a child of the pinned section
        // — never the pinned element itself — and the tween moving it has to stay on
        // ease:'none', or scroll position and carriage position stop agreeing.
        const track = self.selector('.js-how-track')[0];
        if (track) {
          const frame = () => track.parentElement.clientWidth;
          // LEAD_IN is how far right the carriage is parked when the section arrives, as a
          // fraction of the frame. Small on purpose: the section opens with the first card
          // already framed and the second peeking in, and the carriage moves off from there
          // — rather than starting empty and running the first card in from off-screen.
          const LEAD_IN = 0.18;
          // SCROLL_STRETCH buys scroll distance beyond the pixels actually travelled: the
          // cards move slower than the wheel, which is what gives the sequence time to be
          // read. Raise it to slow the carriage down further, lower it to speed it up.
          const SCROLL_STRETCH = 2.2;

          const lead = () => frame() * LEAD_IN;
          const travel = () => Math.max(0, track.scrollWidth - frame());

          gsap.fromTo(
            track,
            { x: () => lead() },
            {
              x: () => -travel(),
              ease: 'none',
              scrollTrigger: {
                trigger: '.js-how',
                start: 'top top',
                end: () => `+=${(lead() + travel()) * SCROLL_STRETCH}`,
                pin: true,
                scrub: 1,
                invalidateOnRefresh: true,
                onUpdate: (st) => gsap.set('.js-how-progress', { scaleX: st.progress }),
              },
            }
          );
        }

        // Section reveals: every group of elements with the same data-reveal value fades
        // and rises together the first time it enters the viewport, then stays put.
        const groups = new Set(
          Array.from(self.selector('[data-reveal]')).map((el) => el.dataset.reveal)
        );

        groups.forEach((group) => {
          gsap.from(`[data-reveal="${group}"]`, {
            y: 28,
            opacity: 0,
            duration: 0.7,
            ease: 'power2.out',
            stagger: 0.12,
            scrollTrigger: {
              trigger: `[data-reveal="${group}"]`,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          });
        });

        // The footer wordmark echoes the hero wordmark's treatment, bookending the page:
        // scrubbed this time, so it rises out of the floor as the page bottoms out.
        gsap.fromTo(
          '.js-footer-wordmark',
          { yPercent: 40, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: '.js-footer-wordmark', start: 'top 95%', end: 'bottom bottom', scrub: 1 },
          }
        );
      });

      // Reduced motion — no parallax, pinning or horizontal remapping. The steps fall back
      // to an ordinary swipeable overflow (see the motion-reduce class on the carriage's
      // viewport); everything else simply renders at rest.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(
          '.js-wordmark, .js-hero-center, .js-hero-foot, .js-hero-tagline, .js-hero-sub, .js-word, .js-solution-card, .js-how-card, [data-reveal], .js-footer-wordmark',
          { opacity: 1, clearProps: 'transform' }
        );
        gsap.set('.js-hero-img', { yPercent: -12, scale: 1 });
      });

      return () => mm.revert();
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="bg-[#fbfbfa] text-[#17211d] antialiased font-['Plus_Jakarta_Sans'] selection:bg-[#7bf6bf] selection:text-[#032b22]">
      {/* Reading progress. Pinned above the nav so it stays legible while the nav hides. */}
      {/* Hero. Sized against the viewport rather than a fixed pixel floor, so the wordmark,
          the tagline and the call to action are all on screen at any window height. svh is
          used over vh so mobile browser chrome can't crop the bottom row either. */}
      <div className="js-hero-wrap px-3 pt-3 pb-3 sm:px-5 sm:pt-4 sm:pb-4 lg:px-0 max-w-[1440px] mx-auto">
        <div className="js-hero relative z-0 w-full rounded-[2.5rem] overflow-hidden h-[calc(100svh_-_1.5rem)] sm:h-[calc(100svh_-_2rem)] min-h-[34rem] max-h-[62rem] flex flex-col px-6 pt-4 pb-6 sm:px-10 sm:pt-5 sm:pb-10 lg:px-12 lg:pt-6 lg:pb-12 text-white shadow-2xl">
          <div className="absolute inset-0 -z-20 overflow-hidden">
            <img
              src="/wp4041839-solar-panel-wallpapers.jpg"
              alt="A field of solar panels under a clear blue sky"
              className="js-hero-img w-full h-[130%] object-cover object-center brightness-[0.85] contrast-[1.05] will-change-transform"
            />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/20 to-black/70 pointer-events-none" />

          {/* Nav. Lives inside the hero rather than fixed to the viewport, so it leaves with
              the hero instead of following the reader down every section. */}
          <header className="relative z-30 w-full shrink-0">
            <div className="flex items-center justify-between gap-4 rounded-full border border-white/15 bg-[#04382c]/80 px-4 sm:px-6 py-2.5 sm:py-3 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.2)] backdrop-blur-xl backdrop-saturate-150">
              <a href="#" className="flex shrink-0 items-center gap-2.5 text-lg sm:text-xl font-bold tracking-tight text-white">
                <img src="/logo.svg" alt="" className="h-8 w-8 rounded-full" />
                <span>HelioGrid</span>
              </a>
              <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-white/90">
                {NAV_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </a>
                ))}
              </nav>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="shrink-0 rounded-full bg-white px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-[#04382c] shadow-sm transition-all hover:bg-emerald-50 active:scale-95"
              >
                Sign In
              </button>
            </div>
          </header>

          <div className="js-hero-center relative z-10 flex flex-1 items-center justify-center w-full text-center pt-6 pb-6 select-none pointer-events-none">
            <h1 className="js-wordmark text-[clamp(2.75rem,12.5vw,11rem)] font-extrabold tracking-tight text-white/90 leading-none">
              HelioGrid
            </h1>
          </div>

          <div className="js-hero-foot relative z-20 w-full shrink-0 flex flex-col md:flex-row items-start md:items-end justify-between gap-5 pt-5 border-t border-white/15">
            <div className="max-w-xl">
              <p className="js-hero-tagline text-2xl sm:text-3xl lg:text-[2.75rem] font-bold tracking-tight text-white leading-[1.1]">
                Smart Technology <br />
                <span className="font-['Newsreader'] italic font-normal text-emerald-300 text-3xl sm:text-4xl lg:text-5xl tracking-normal">
                  Greener Future
                </span>
              </p>
            </div>
            <div className="max-w-md md:text-right">
              <p className="js-hero-sub text-xs sm:text-sm text-stone-200/90 leading-relaxed">
                Peer-to-peer rooftop solar trading, 7-day scheduled battery slot reservations, and server-verified clean kilowatt injection.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* The statement gets a screen of its own and sits centred in it, so that when the
          section is pinned the sentence is already where the eye is. */}
      <section id="about" className="flex min-h-[100svh] items-center px-6 lg:px-12 py-24">
        <div className="mx-auto w-full max-w-6xl">
          <div data-reveal="about" className="flex items-center gap-2 mb-8">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-stone-200/80 text-stone-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              About HelioGrid
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-[2.65rem] font-medium leading-[1.3] text-[#17211d] max-w-5xl tracking-tight">
            <Words text={ABOUT_LEAD} />
            <span className="js-word inline-flex items-center align-middle mx-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-base sm:text-lg font-normal gap-1.5">
              <span className="material-symbols-outlined text-emerald-700 text-lg">solar_power</span>
              <span className="font-medium text-xs sm:text-sm">surplus solar</span>
            </span>
            <Words text={ABOUT_TAIL} />
          </h2>
        </div>
      </section>

      <section className="py-8 sm:py-16 px-6 lg:px-12 max-w-7xl mx-auto" id="solutions">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          <div data-reveal="solutions-head" className="lg:col-span-3 space-y-4 lg:sticky lg:top-28">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17211d]">Core Solutions</h3>
            <p className="text-stone-600 text-sm leading-relaxed">
              Precision microgrid dispatch tools that turn decentralized solar overproduction into scheduled, verified trades.
            </p>
            <div className="pt-4">
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 bg-[#17211d] text-white hover:bg-emerald-950 active:scale-95 text-xs sm:text-sm font-medium px-5 py-3 rounded-full transition-all"
              >
                <span>See how it works</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-6">
            {CORE_SOLUTIONS.map((card) => (
              <div
                key={card.key}
                className={
                  // The low/transparent start state is set in GSAP, not in Tailwind — see the
                  // note on the progress bar about v4's standalone translate property.
                  'js-solution-card ' +
                  (card.kind === 'photo'
                    // z-0 for the same reason as the hero: this card's image/gradient below use
                    // negative z-index and need this box to own its own stacking context.
                    ? 'group relative z-0 rounded-3xl overflow-hidden min-h-[340px] p-7 flex flex-col justify-end text-white shadow-md transition-transform hover:-translate-y-1'
                    : card.kind === 'light'
                      ? 'rounded-3xl bg-[#e5f2e3] p-7 flex flex-col justify-between border border-emerald-200/60 shadow-sm transition-transform hover:-translate-y-1'
                      : 'group relative rounded-3xl overflow-hidden min-h-[340px] p-7 flex flex-col justify-between text-white shadow-md bg-[#04382c] transition-transform hover:-translate-y-1')
                }
              >
                {card.kind === 'photo' && (
                  <>
                    {/* Taller than its frame on purpose: the extra height is the room the
                        parallax drift moves through. */}
                    <img
                      src="/images.jpeg"
                      alt=""
                      className="js-solution-photo absolute inset-x-0 -top-[10%] w-full h-[120%] object-cover brightness-[0.7] contrast-[1.1] -z-10 will-change-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent -z-10" />
                    <div className="space-y-2">
                      <h4 className="text-xl font-bold tracking-tight text-white">{card.title}</h4>
                      <p className="text-xs text-stone-200/90 leading-relaxed">{card.body}</p>
                    </div>
                  </>
                )}

                {card.kind === 'light' && (
                  <div>
                    <div className="flex items-center gap-3 mb-6 text-emerald-900">
                      <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-800">sensors</span>
                      </div>
                    </div>
                    <h4 className="text-xl font-bold tracking-tight text-emerald-950 mb-2">{card.title}</h4>
                    <p className="text-xs text-emerald-900/80 leading-relaxed">{card.body}</p>
                  </div>
                )}

                {card.kind === 'metric' && (
                  <>
                    <div>
                      <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-emerald-300 block">{card.metric}</span>
                      <span className="text-xs uppercase tracking-wider text-emerald-100/80 font-medium">{card.metricLabel}</span>
                    </div>
                    <div className="space-y-1.5 pt-6">
                      <h4 className="text-lg font-bold tracking-tight text-white">{card.title}</h4>
                      <p className="text-xs text-stone-200/80 leading-relaxed">{card.body}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-white border-y border-stone-200/70">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Held in view while its three cards pass, so the heading keeps framing them. */}
          <div data-reveal="roles-head" className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#17211d]">
              Built for Every Role <br />
              <span className="text-stone-500 font-normal">on the Grid</span>
            </h3>
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
            {ROLES.map((role) => (
              <div key={role.key} data-reveal="roles-cards" className="rounded-3xl bg-stone-50 border border-stone-200/80 p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-full bg-[#04382c] flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-300 text-xl">{role.icon}</span>
                  </div>
                  <span className="text-[11px] font-bold text-stone-500 tracking-wider uppercase">{role.tag}</span>
                </div>
                <h4 className="text-lg font-bold text-stone-900">{role.title}</h4>
                <p className="text-sm text-stone-600 leading-relaxed">{role.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works. Pinned while the carriage travels sideways; without motion it is a
          plain horizontal overflow the reader can swipe. */}
      <section id="how-it-works" className="js-how relative overflow-hidden min-h-[100svh] flex flex-col justify-center py-16 sm:py-20">
        <div className="px-6 lg:px-12 max-w-7xl mx-auto w-full mb-10">
          <div data-reveal="how-head" className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Frictionless 3-Step Flow
            </span>
            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#17211d]">How HelioGrid Works</h3>
            <p className="text-stone-600 text-sm">From scheduled reservation to verified physical settlement.</p>
            {/* Fills with the carriage, so the reader can see how much of the flow is left. */}
            <div className="pt-3">
              <div className="h-[3px] w-40 overflow-hidden rounded-full bg-stone-200">
                <div
                  aria-hidden="true"
                  style={{ transform: 'scaleX(0)' }}
                  className="js-how-progress h-full w-full origin-left bg-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="js-how-viewport overflow-hidden motion-reduce:overflow-x-auto">
          <div className="js-how-track flex w-max gap-6 px-6 lg:px-12 will-change-transform">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <article
                key={step.number}
                className="js-how-card w-[80vw] sm:w-[24rem] lg:w-[30rem] shrink-0 min-h-[20rem] rounded-3xl bg-white border border-stone-200/80 p-8 sm:p-10 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.5)] flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#e5f2e3] text-emerald-900 flex items-center justify-center font-bold text-lg mb-6">
                    {step.number}
                  </div>
                  <h4 className="text-xl sm:text-2xl font-bold text-stone-900 mb-2">{step.title}</h4>
                  <p className="text-sm text-stone-600 leading-relaxed">{step.body}</p>
                </div>
                <div className="pt-6 mt-6 border-t border-stone-100 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-sm">{step.icon}</span>
                  <span>{step.footnote}</span>
                </div>
              </article>
            ))}

            {/* The closing panel: the rule that applies across all three steps, plus the way in. */}
            <article className="js-how-card w-[80vw] sm:w-[24rem] lg:w-[30rem] shrink-0 min-h-[20rem] rounded-3xl bg-[#04382c] text-white p-8 sm:p-10 shadow-md flex flex-col justify-between">
              <span className="material-symbols-outlined text-emerald-300 text-3xl">published_with_changes</span>
              <div className="space-y-3">
                <h4 className="text-xl sm:text-2xl font-bold tracking-tight">Flexible, right up to the slot</h4>
                <p className="text-xs text-stone-200/80 leading-relaxed">
                  Modify or cancel a reservation free of charge up to 12 hours before your slot. The rule is enforced centrally, so it reads the same on every client.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="mt-2 bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-[#032b22] text-sm font-bold px-6 py-3 rounded-full transition-all inline-flex items-center gap-2"
                >
                  <span>Sign In to Console</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 px-6 lg:px-12 max-w-7xl mx-auto" id="vision">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-8">
            <h3 data-reveal="vision-head" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#17211d]">
              Our Vision <br />
              <span className="text-stone-500 font-normal">for the community grid.</span>
            </h3>
            <div data-reveal="vision-head" className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-sm space-y-6">
              <p className="text-base sm:text-lg text-stone-800 leading-relaxed font-normal">
                HelioGrid exists so a household with a rooftop array isn’t stuck exporting surplus power for nothing.
                It connects solar prosumers directly to their nearest community battery hub, with every reservation,
                approval, and transfer verified centrally — never trusted purely from a device in someone’s hand.
              </p>
            </div>
          </div>
          <div className="lg:col-span-5 space-y-6">
            <div data-reveal="vision-side" className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-xs space-y-4">
              <h5 className="text-base font-bold text-stone-900">What that means in practice</h5>
              <ul className="space-y-3">
                {CAPABILITIES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-stone-700 leading-relaxed">
                    <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">check_circle</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-3 sm:px-5 lg:px-7 pb-4">
        <div className="relative w-full rounded-[2.5rem] overflow-hidden bg-[#032b22] text-white pt-16 sm:pt-20 pb-8 px-6 sm:px-12 lg:px-16 shadow-2xl">
          <div data-reveal="cta" className="max-w-3xl mx-auto text-center space-y-6 mb-16 sm:mb-20">
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              Let’s Build a Sustainable Tomorrow
            </h3>
            <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
              Sign in to reserve a slot, manage a microgrid node, or verify a transfer — whichever role is yours.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-[#032b22] text-sm font-bold px-8 py-3.5 rounded-full transition-all shadow-md inline-flex items-center gap-2"
            >
              <span>Sign In to Console</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-10 border-t border-white/15 text-xs text-stone-300">
            <div className="col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <img src="/logo.svg" alt="" className="w-6 h-6 rounded-full" />
                <span>HelioGrid</span>
              </div>
              <p className="text-stone-400 max-w-sm leading-relaxed text-xs">
                Peer-to-peer renewable microgrid dispatch, scheduled intake bookings, and server-verified transfers.
              </p>
              <div className="pt-2 text-stone-400 text-[11px]">© 2026 HelioGrid. A Smart Solar Microgrid Trading System project.</div>
            </div>
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group} className="space-y-2.5">
                <p className="text-white font-semibold text-xs tracking-wider uppercase">{group}</p>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="hover:text-emerald-300 transition-colors">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="w-full text-center mt-12 sm:mt-16 -mb-10 sm:-mb-14 overflow-hidden select-none pointer-events-none">
            <span className="js-footer-wordmark text-[20vw] sm:text-[18vw] lg:text-[16rem] font-extrabold tracking-tight text-white/95 leading-none block">
              HelioGrid
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

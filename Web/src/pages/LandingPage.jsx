// File: LandingPage.jsx
// Purpose: Public marketing home at /.

import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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

const EXAMPLE_STATIONS = [
  { code: 'STN-001', name: 'Example Coastal Hub', window: '06:00 – 18:00', capacity: '120 kWh' },
  { code: 'STN-002', name: 'Example Hill Country Hub', window: '07:00 – 17:30', capacity: '95 kWh' },
  { code: 'STN-003', name: 'Example Urban Hub', window: '06:30 – 18:30', capacity: '150 kWh' },
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
    { label: 'How It Works', href: '#how-it-works' },
  ],
  Network: [
    { label: 'Stations', href: '#stations' },
    { label: 'Our Vision', href: '#vision' },
  ],
};

export default function LandingPage() {
  const navigate = useNavigate();
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context((self) => {
      const mm = gsap.matchMedia();

      // Full motion — a critically-damped ease-out by default (no overshoot on a scripted,
      // non-gesture entrance), reserved for the two moments that carry real emphasis: the
      // hero wordmark settling into place, and hover feedback on primary actions.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero entrance: nav, then the giant wordmark, then the tagline/CTA row.
        const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        heroTl
          .from('.js-nav', { y: -16, opacity: 0, duration: 0.6 })
          .from('.js-wordmark', { opacity: 0, y: 24, scale: 0.97, duration: 0.9 }, '-=0.3')
          .from('.js-hero-tagline', { y: 16, opacity: 0, duration: 0.6 }, '-=0.45')
          .from('.js-hero-sub', { y: 16, opacity: 0, duration: 0.5 }, '-=0.4')
          .from('.js-hero-cta', { y: 12, opacity: 0, duration: 0.5 }, '-=0.35');

        // Nav: hidden on scroll down, brought back on scroll up, always shown near the top.
        // overwrite:true so a quick direction change (interruptibility) redirects the tween
        // instantly rather than queueing a reversal behind whatever's still playing.
        ScrollTrigger.create({
          start: 0,
          onUpdate: (st) => {
            const y = st.scroll();
            if (y < 140) {
              gsap.to('.js-nav', { yPercent: 0, opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
            } else if (st.direction === 1) {
              gsap.to('.js-nav', { yPercent: -160, opacity: 0, duration: 0.4, ease: 'power2.inOut', overwrite: true });
            } else {
              gsap.to('.js-nav', { yPercent: 0, opacity: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
            }
          },
        });

        // Hero image: resting position first (GSAP owns this element's transform entirely —
        // see the comment on the <img> itself), then the scroll-linked parallax + expand.
        // ease: 'none' is required on a scrubbed tween so scroll position and the image's
        // position/scale stay in exact 1:1 sync, per how ScrollTrigger scrub is meant to be used.
        gsap.set('.js-hero-img', { yPercent: -15, scale: 1, transformOrigin: '50% 50%' });
        gsap.to('.js-hero-img', {
          yPercent: -5,
          scale: 1.22,
          ease: 'none',
          scrollTrigger: { trigger: '.js-hero', start: 'top top', end: 'bottom top', scrub: true },
        });

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

        // The footer wordmark echoes the hero wordmark's treatment, bookending the page.
        gsap.from('.js-footer-wordmark', {
          opacity: 0,
          y: 30,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.js-footer-wordmark', start: 'top 90%' },
        });
      });

      // Reduced motion — no sliding/parallax/expand, but the nav's hide-on-scroll is a
      // functional affordance (getting a way back to nav without scrolling to the top), not
      // just decoration, so it's kept — as an instant opacity toggle instead of a slide.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(
          '.js-wordmark, .js-hero-tagline, .js-hero-sub, .js-hero-cta, [data-reveal], .js-footer-wordmark',
          { opacity: 1, clearProps: 'transform' }
        );
        gsap.set('.js-hero-img', { yPercent: -15, scale: 1 });

        ScrollTrigger.create({
          start: 0,
          onUpdate: (st) => {
            const y = st.scroll();
            const visible = y < 140 || st.direction === -1;
            gsap.set('.js-nav', { opacity: visible ? 1 : 0, yPercent: 0 });
          },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="bg-[#fbfbfa] text-[#17211d] antialiased font-['Plus_Jakarta_Sans'] selection:bg-[#7bf6bf] selection:text-[#032b22]">
      {/* Nav - fixed to the viewport (not nested in the hero) */}
      <header className="js-nav fixed top-3 sm:top-8 inset-x-3 sm:inset-x-5 lg:inset-x-7 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between bg-[#04382c]/80 backdrop-blur-xl backdrop-saturate-150 border border-white/15 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-[0_8px_30px_-6px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.2)]">
          <a href="#" className="flex items-center gap-2.5 text-white font-bold text-lg sm:text-xl tracking-tight">
            <img src="/logo.svg" alt="" className="w-8 h-8 rounded-full" />
            <span>HelioGrid</span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/90">
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#vision" className="hover:text-white transition-colors">Our Vision</a>
          </nav>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="bg-white text-[#04382c] hover:bg-emerald-50 active:scale-95 text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all shadow-sm"
          >
            Sign In
          </button>
        </div>
      </header>

      <div className="px-3 sm:px-5 lg:px-7 pt-4 pb-12 sm:pb-16 max-w-[1440px] mx-auto">

        <div className="js-hero relative z-0 w-full rounded-[2.5rem] overflow-hidden min-h-[680px] lg:min-h-[780px] flex flex-col justify-between p-6 sm:p-10 lg:p-12 text-white shadow-2xl">
          <div className="absolute inset-0 -z-20 overflow-hidden">
            <img
              src="/wp4041839-solar-panel-wallpapers.jpg"
              alt="A field of solar panels under a clear blue sky"
              className="js-hero-img w-full h-[130%] object-cover object-center brightness-[0.85] contrast-[1.05]"
            />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/20 to-black/70 pointer-events-none" />

          <div className="relative z-10 w-full text-center my-auto pt-20 sm:pt-24 lg:pt-28 pb-12 select-none pointer-events-none">
            <h1 className="js-wordmark text-[17vw] sm:text-[15vw] lg:text-[13rem] font-extrabold tracking-tight text-white/90 leading-none">
              HelioGrid
            </h1>
          </div>

          <div className="relative z-20 w-full flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pt-6 border-t border-white/15">
            <div className="max-w-xl">
              <p className="js-hero-tagline text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
                Smart Technology <br />
                <span className="font-['Newsreader'] italic font-normal text-emerald-300 text-4xl sm:text-5xl lg:text-6xl tracking-normal">
                  Greener Future
                </span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center md:items-end gap-5 lg:gap-8 max-w-lg">
              <p className="js-hero-sub text-xs sm:text-sm text-stone-200/90 leading-relaxed">
                Peer-to-peer rooftop solar trading, 7-day scheduled battery slot reservations, and server-verified clean kilowatt injection.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="js-hero-cta whitespace-nowrap bg-white text-[#04382c] hover:bg-emerald-100 active:scale-95 text-sm font-semibold px-6 py-3 rounded-full transition-all shadow-md inline-flex items-center gap-2"
              >
                <span>Sign In to Console</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="py-16 sm:py-24 px-6 lg:px-12 max-w-6xl mx-auto" id="about">
        <div data-reveal="about" className="flex items-center gap-2 mb-8">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-stone-200/80 text-stone-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            About HelioGrid
          </span>
        </div>
        <h2 data-reveal="about" className="text-2xl sm:text-3xl lg:text-[2.65rem] font-medium leading-[1.3] text-[#17211d] max-w-5xl tracking-tight">
          Built so local communities can trade
          <span className="inline-flex items-center align-middle mx-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-base sm:text-lg font-normal gap-1.5">
            <span className="material-symbols-outlined text-emerald-700 text-lg">solar_power</span>
            <span className="font-medium text-xs sm:text-sm">surplus solar</span>
          </span>
          energy directly with each other, with every rule enforced centrally and verified before it ever reaches a client.
        </h2>
      </section>

      <section className="py-8 sm:py-16 px-6 lg:px-12 max-w-7xl mx-auto" id="solutions">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          <div data-reveal="solutions-head" className="lg:col-span-3 space-y-4">
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
                data-reveal="solutions-cards"
                className={
                  card.kind === 'photo'
                    // z-0 for the same reason as the hero: this card's image/gradient below use
                    // negative z-index and need this box to own its own stacking context.
                    ? 'group relative z-0 rounded-3xl overflow-hidden min-h-[340px] p-7 flex flex-col justify-end text-white shadow-md transition-transform hover:-translate-y-1'
                    : card.kind === 'light'
                      ? 'rounded-3xl bg-[#e5f2e3] p-7 flex flex-col justify-between border border-emerald-200/60 shadow-sm transition-transform hover:-translate-y-1'
                      : 'group relative rounded-3xl overflow-hidden min-h-[340px] p-7 flex flex-col justify-between text-white shadow-md bg-[#04382c] transition-transform hover:-translate-y-1'
                }
              >
                {card.kind === 'photo' && (
                  <>
                    <img
                      src="/images.jpeg"
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover brightness-[0.7] contrast-[1.1] transition-transform duration-700 group-hover:scale-105 -z-10"
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
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div data-reveal="roles-head" className="mb-12">
            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#17211d]">
              Built for Every Role <br />
              <span className="text-stone-500 font-normal">on the Grid</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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

      <section className="py-16 sm:py-24 px-6 lg:px-12 max-w-7xl mx-auto" id="how-it-works">
        <div data-reveal="how-head" className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800">
            Frictionless 3-Step Flow
          </span>
          <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#17211d]">How HelioGrid Works</h3>
          <p className="text-stone-600 text-sm">From scheduled reservation to verified physical settlement.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <div key={step.number} data-reveal="how-steps" className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#e5f2e3] text-emerald-900 flex items-center justify-center font-bold text-lg mb-6">
                  {step.number}
                </div>
                <h4 className="text-xl font-bold text-stone-900 mb-2">{step.title}</h4>
                <p className="text-sm text-stone-600 leading-relaxed">{step.body}</p>
              </div>
              <div className="pt-6 mt-6 border-t border-stone-100 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <span className="material-symbols-outlined text-sm">{step.icon}</span>
                <span>{step.footnote}</span>
              </div>
            </div>
          ))}
        </div>
        <div data-reveal="how-banner" className="mt-8 bg-[#edf7eb] rounded-2xl p-5 border border-emerald-200/70 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-800 text-2xl">published_with_changes</span>
            <p className="text-xs sm:text-sm text-emerald-950 font-medium">
              <strong>Flexible cancellation policy:</strong> modify or cancel a reservation free of charge up to 12 hours before your slot.
            </p>
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
                      <a href={link.href} className="hover:text-emerald-300 transition-colors">{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="js-footer-wordmark w-full text-center mt-12 sm:mt-16 -mb-10 sm:-mb-14 overflow-hidden select-none pointer-events-none">
            <span className="text-[20vw] sm:text-[18vw] lg:text-[16rem] font-black tracking-tight text-white/95 leading-none block">
              HelioGrid
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

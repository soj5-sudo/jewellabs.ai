'use strict';
/* ═══════════════════════════════════════════════════════════
   JEWEL LABS  |  demo-data.js
   Data for the Agent Theater on the marketing site.
   Single agent: the Quoting Agent. A request lands, the agent
   renders the piece, prices it against the Rapaport list and
   live metal, and replies with an indicative quote.
   No logic here. Exposes window.JL_DEMO.
   Figures are indicative and the inbox is staged.
   ═══════════════════════════════════════════════════════════ */
window.JL_DEMO = {

  icons: {
    star: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M9 1.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L1.8 7.1l5-.7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    clip: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M12.8 5.2l-5.6 5.6a1.7 1.7 0 0 0 2.4 2.4l6-6a3.2 3.2 0 0 0-4.5-4.5l-6 6a4.7 4.7 0 0 0 6.6 6.6l5.2-5.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M15 9H3.5M8.5 4L3.5 9l5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    archive: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2.5 3h13v3h-13z M3.5 6v9h11V6 M7 9.5h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 4.5h11M7 4.5V3h4v1.5M4.5 4.5l1 11h7l1-11M7.5 7.5v5M10.5 7.5v5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    dots: '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="3.5" r="1.4" fill="currentColor"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="9" cy="14.5" r="1.4" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    blockx: '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.3 3.3l7.4 7.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    inbox: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2.5 3h13v12h-13z M2.5 10.5h4.2c.4 1.3 1.2 2 2.3 2s1.9-.7 2.3-2h4.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    diamond: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 8 16 12 12 16 8 12Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2.5V8M12 16v5.5M2.5 12H8M16 12h5.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    price: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2.2v13.6M12.2 5.1c-.6-1-1.8-1.6-3.2-1.6-2 0-3.3 1-3.3 2.5S6.9 8.8 9 9.2s3.3 1 3.3 2.6S11 14.5 9 14.5c-1.5 0-2.7-.6-3.3-1.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    filter: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2.5 4h13l-5 6v4.5l-3 1.5V10z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    send: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 9l13.5-6-3.4 12-3.4-4.3L2 9zm6.7 1.7l5.4-6.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M9 5.2V9l2.6 1.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  },

  scenarios: {

    /* ── THE QUOTING AGENT ── */
    quote: {
      key: 'quote',
      teamName: 'Agent Team',
      agentName: 'Quoting Agent',
      agentSub: 'Four agents, one desk, coordinating over A2A',
      account: 'quotes@jewellabs.org',
      feature: 'q1', // worked end to end during the run to reveal the full quote
      cta: { href: 'https://studio.jewellabs.org', label: 'Try the agents yourself' },
      openLine: 'Overnight inbox: 7 threads. Filters is classifying intent.',
      closeLines: [
        'Wrapping the run',
        '5 quotes sent, 2 threads filtered. Four agents, zero touch.',
      ],
      finaleState: '5 quotes sent',
      finale: {
        title: 'Overnight queue cleared',
        stat: '5 of 5',
        statLabel: 'Quote requests answered, unattended',
        rows: [
          ['Agents coordinated', 'Filters, Quoting, Pricing, Updates'],
          ['A2A messages', '{a2a} exchanged over the run'],
          ['Owner notified', 'Slack, every quote'],
        ],
        note: 'Staged demo. Figures indicative. The studio runs the same agents on your own inbox.',
      },
      emails: [
        {
          id: 'n1', noise: true,
          from: { name: 'GIA Laboratory', email: 'reports@gia.edu', initial: 'G', hue: 145 },
          subject: 'Your grading reports are ready',
          snippet: 'Three reports completed for submission 2288-4471. Download enclosed.',
          time: '6:48 AM',
        },
        {
          id: 'n2', noise: true,
          from: { name: 'JCK Events', email: 'news@jckonline.com', initial: 'J', hue: 25 },
          subject: 'JCK Las Vegas 2026, early registration',
          snippet: 'Save the date and register early for next year at the Venetian.',
          time: '6:55 AM',
        },
        {
          id: 'q1',
          from: { name: 'Claire Bennett', email: 'claire.b.4821@gmail.com', initial: 'C', hue: 340 },
          subject: 'Engagement ring, 2 ct oval',
          snippet: 'A 2 carat oval solitaire on a thin platinum band, budget 20 to 24k.',
          time: '7:02 AM',
          chip: 'Replied',
          beat: 1900,
          console: [
            'Reading the brief from Claire Bennett',
            '2.00 ct oval solitaire, platinum, budget fits',
            'Pulling Rapaport RAPI and three comparable listings',
            'Render composed. Reply sent, indicative $21,400.',
          ],
          body:
'Hi, I am looking for an engagement ring. A 2 carat oval solitaire on a thin platinum band, something clean and classic. Budget is around 20 to 24k. Could you show me what it would look like and give me a price? The wedding is in October so there is time.',
          reply: {
            img: 'assets/rings/solitaire.jpg',
            intro: 'Thank you for the brief. Here is the piece as described, with an indicative figure. The price is worked from the Rapaport list and live metal, not a guess.',
            priceBasis: [
              ['Rapaport price list', 'RAPI 2.00 ct oval, D to F, VS'],
              ['Live comparison', 'three matched listings'],
              ['Metal', 'Platinum 950 at spot'],
            ],
            spec: [
              ['Stone', '2.00 ct oval, D to F colour, VS clarity'],
              ['Metal', 'Platinum 950, 1.8 mm band'],
              ['Setting', 'Four prong solitaire, cathedral'],
              ['Indicative', '$21,400'],
            ],
          },
        },
        {
          id: 'q2',
          from: { name: 'Marcus Ho', email: 'marcus.ho.hk@gmail.com', initial: 'M', hue: 210 },
          subject: 'Tennis bracelet, tenth anniversary',
          snippet: 'Around 5 carats total in white gold, classic four prong line.',
          time: '7:18 AM',
          chip: 'Replied',
          beat: 1700,
          console: [
            'Reading the brief from Marcus Ho',
            '5.00 ct total, 18k white gold line bracelet',
            'Pricing the run against Rapaport and gold spot',
            'Render composed. Reply sent, indicative $9,400.',
          ],
          body:
'Tennis bracelet for our tenth anniversary. Something around 5 carats total, white gold, classic four prong line. What are we looking at price wise, and how long to make?',
          reply: {
            img: 'assets/rings/tennis.jpg',
            intro: 'Congratulations on the tenth. Classic line bracelet below, sized to a 6.5 inch wrist unless you tell us otherwise.',
            priceBasis: [
              ['Rapaport price list', '45 rounds, G to H, VS, per carat'],
              ['Live comparison', 'four matched listings'],
              ['Metal', '18k white gold at spot'],
            ],
            spec: [
              ['Stones', '45 round brilliants, 5.00 ct total'],
              ['Metal', '18k white gold, four prong line'],
              ['Clasp', 'Box clasp with double safety'],
              ['Indicative', '$9,400'],
            ],
          },
        },
        {
          id: 'q3',
          from: { name: 'James Whitfield', email: 'jwhitfield.ldn@gmail.com', initial: 'J', hue: 262 },
          subject: 'Signet ring with a small stone',
          snippet: 'Yellow gold with a small stone set flush into the face. Classic.',
          time: '7:47 AM',
          chip: 'Replied',
          beat: 1600,
          console: [
            'Reading the brief from James Whitfield',
            '18k signet, 0.15 ct flush set, engraving optional',
            'Pricing stone and gold weight against spot',
            'Render composed. Reply sent, indicative $1,480.',
          ],
          body:
'Do you make signet rings? I want one in yellow gold with a small stone set flush into the face. Classic, nothing flashy. Open to engraving later.',
          reply: {
            img: 'assets/rings/signet.jpg',
            intro: 'We do. Oval face signet below, stone set flush so it reads as a detail, not a feature. Engraving can be added any time.',
            priceBasis: [
              ['Rapaport price list', '0.15 ct round, flush set'],
              ['Gold weight', '9.4 g, 18k yellow at spot'],
              ['Making', 'oval face, hand finished'],
            ],
            spec: [
              ['Stone', '0.15 ct round, flush set'],
              ['Metal', '18k yellow gold, oval face'],
              ['Face', '12 by 10 mm, hand finished'],
              ['Indicative', '$1,480'],
            ],
          },
        },
        {
          id: 'q4',
          from: { name: 'Sofia Marino', email: 'sofia.marino.mi@gmail.com', initial: 'S', hue: 150 },
          subject: 'Full eternity band, size 6',
          snippet: 'To stack with my engagement ring. Platinum, around 2 carats total.',
          time: '8:05 AM',
          chip: 'Replied',
          beat: 1700,
          console: [
            'Reading the brief from Sofia Marino',
            '2.10 ct full eternity, platinum, size 6',
            'Pricing 21 stones against Rapaport and platinum spot',
            'Render composed. Reply sent, indicative $5,200.',
          ],
          body:
'I want a full eternity band, size 6, to stack with my engagement ring. Platinum. Around 2 carats total. Shared prong if that keeps it low profile.',
          reply: {
            img: 'assets/rings/eternity.jpg',
            intro: 'Shared prong keeps the profile low and lets the stones run edge to edge. Note that full eternity bands cannot be resized, so we confirm size twice.',
            priceBasis: [
              ['Rapaport price list', '21 rounds, F to G, VS, per carat'],
              ['Live comparison', 'three matched listings'],
              ['Metal', 'Platinum 950 at spot'],
            ],
            spec: [
              ['Stones', '21 round brilliants, 2.10 ct total'],
              ['Metal', 'Platinum 950, shared prong'],
              ['Size', '6, non resizable'],
              ['Indicative', '$5,200'],
            ],
          },
        },
        {
          id: 'q5',
          from: { name: 'Daniel Okafor', email: 'd.okafor.atl@gmail.com', initial: 'D', hue: 45 },
          subject: 'Studs under 2k, graduation gift',
          snippet: 'Diamond studs for my daughter, screw backs, under 2k if possible.',
          time: '8:22 AM',
          chip: 'Replied',
          beat: 1600,
          console: [
            'Reading the brief from Daniel Okafor',
            '0.50 ct total studs, screw backs, under budget',
            'Pricing the pair against Rapaport and gold spot',
            'Render composed. Reply sent, indicative $1,720.',
          ],
          body:
'Diamond studs under 2k, for my daughter, she graduates in May. Screw backs so she does not lose them. White metal.',
          reply: {
            img: 'assets/rings/studs.jpg',
            intro: 'Matched pair below with screw backs as asked. A quarter carat each side wears clean and stays under budget.',
            priceBasis: [
              ['Rapaport price list', '2 rounds, G, SI1, per carat'],
              ['Live comparison', 'three matched listings'],
              ['Metal', '18k white gold at spot'],
            ],
            spec: [
              ['Stones', '2 round brilliants, 0.50 ct total'],
              ['Metal', '18k white gold, screw backs'],
              ['Setting', 'Four prong baskets'],
              ['Indicative', '$1,720'],
            ],
          },
        },
      ],
    },
  },
};

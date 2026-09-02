import Image from 'next/image';
import Link from 'next/link';

import { Callout, Figure } from '@/components/marketing/prose';
import { appHref } from '@/lib/hosts';

/**
 * The blog. Each post is plain JSX so it reads like a document here and
 * needs no build step or Markdown pipeline. Add a post by appending to the
 * array; the index, the post pages, the sitemap and the feed all derive
 * from it. Keep `date` as an ISO day so ordering is unambiguous.
 */

export type PostCategory = 'Product' | 'Engineering' | 'Update';

export type Post = {
  slug: string;
  title: string;
  /** One or two sentences shown on the index and used as the meta description. */
  excerpt: string;
  /** ISO date (YYYY-MM-DD) of publication. */
  date: string;
  category: PostCategory;
  readingMinutes: number;
  /** Optional cover screenshot for the index card and post header. */
  cover?: { src: string; alt: string; phone?: boolean };
  Body: () => React.ReactElement;
};

/* ── Small shared pieces ────────────────────────────────────────────────── */

function Shot({
  src,
  alt,
  caption,
  phone = false,
}: {
  src: string;
  alt: string;
  caption?: string;
  phone?: boolean;
}) {
  if (phone) {
    return (
      <figure className="mt-8 flex flex-col items-center">
        <div className="w-[240px] overflow-hidden rounded-[2rem] border-[7px] border-ink bg-ink shadow-2xl shadow-ink/25">
          <Image src={src} alt={alt} width={390} height={844} sizes="240px" className="w-full rounded-[1.5rem]" />
        </div>
        {caption && <figcaption className="mt-3 text-center text-[13px] text-muted">{caption}</figcaption>}
      </figure>
    );
  }
  return (
    <Figure caption={caption}>
      <Image src={src} alt={alt} width={1440} height={900} sizes="(max-width: 768px) 100vw, 720px" className="w-full" />
    </Figure>
  );
}

/* ── The posts, newest last in this file, sorted by date when read ─────── */

export const posts: Post[] = [
  {
    slug: 'paper-punch-cards-without-the-paper',
    title: 'Paper punch cards, without the paper',
    excerpt:
      'Why we built Stamposa, what we kept from the cardboard card, and the three people it has to work for at the same time.',
    date: '2026-08-24',
    category: 'Product',
    readingMinutes: 5,
    cover: {
      src: '/screens/customer-card.png',
      alt: 'A Stamposa customer loyalty card on a phone with stamps, QR code and wallet buttons',
      phone: true,
    },
    Body: () => (
      <>
        <p>
          The paper punch card is a good product. It costs nothing to explain. A customer buys a
          coffee, someone behind the counter punches a hole, and after ten holes the coffee is
          free. Nobody has ever needed a tutorial for it.
        </p>
        <p>
          It also fails in the same three ways in every shop that uses it. The card is at home when
          the customer is in the queue. The owner has no idea how many are out there or how many
          are about to come due. And the customer list, the one asset a loyalty program is supposed
          to build, does not exist, because nobody wrote the names down.
        </p>
        <p>
          Stamposa is our attempt to keep the first thing and fix the other three. The whole product
          fits in a sentence: a customer scans one QR, staff stamp from any phone, and the owner
          keeps the list.
        </p>

        <h2>What we refused to change</h2>
        <p>
          Loyalty apps usually fail at the counter, not on the dashboard. If stamping takes longer
          than punching a hole, staff stop doing it during the rush, and a program that only runs
          when the shop is quiet is not a program. So we set two rules before writing any code.
        </p>
        <ul>
          <li>
            <strong>No app for the customer.</strong> They scan the shop’s QR, verify their number
            once, and the card opens in the browser. It is theirs from that moment. There is nothing
            to install and nothing to update.
          </li>
          <li>
            <strong>No hardware for the shop.</strong> Staff sign in on whatever phone is already in
            their pocket. The camera reads the customer’s card. The standee on the counter is a
            printout.
          </li>
        </ul>
        <p>
          Everything else, from wallet passes to analytics, sits behind those two rules. If a feature
          would slow the counter down, it does not ship.
        </p>

        <h2>Three people, three screens</h2>
        <p>
          A loyalty program is used by three different people who want different things, and one
          screen cannot serve all of them. So there are three.
        </p>
        <p>
          <strong>The owner</strong> gets a dashboard that refreshes on its own: today’s stamps,
          rewards waiting to be handed over, and a live feed of what is happening at the counter.
          Behind it sit the customer list, a ledger of every stamp, analytics over 7, 30 and 90
          days, and settings for the logo, brand colour and consent wording.
        </p>
        <p>
          <strong>The counter</strong> gets one screen with one big search box. Type a phone number,
          a name or a customer code, or point the camera at the card, and the customer comes up.
          One tap adds the stamp. If it was the wrong customer, there is an undo button with a
          countdown. That is most of the job.
        </p>
        <p>
          <strong>The customer</strong> gets their card: the shop’s colours, the stamp grid, how many
          to go, and a QR panel to show at the counter. It updates while they watch, so the new
          stamp appears before the phone goes back in the pocket. If they want it in Apple Wallet
          or Google Wallet, that is one more tap.
        </p>

        <Shot
          src="/screens/staff-console.png"
          alt="Stamposa staff console on a phone showing customer search and add-stamp buttons"
          caption="The counter console. Search, stamp, undo, enrol. Nothing else on the screen."
          phone
        />

        <h2>The list is yours</h2>
        <p>
          The quiet reason to run a loyalty program is to know who your regulars are. Stamposa
          records a name and a phone number or email for every customer who joins, together with
          their visit history, and the owner can export all of it to CSV at any time. That is not a
          premium tier. A loyalty tool that holds your customer list hostage has the incentives
          backwards.
        </p>
        <p>
          Consent is recorded too, with the exact wording the customer agreed to, because marketing
          messages should be something a customer opted into, not something that happened to them.
          The marketing checkbox is separate and unticked by default.
        </p>

        <h2>Where it is today</h2>
        <p>
          Stamposa is live at{' '}
          <Link href={appHref('/merchant/login')}>app.stamposa.com</Link>. Setting up takes an
          afternoon at most: create the card, print the QR, add your staff. The{' '}
          <Link href="/guide">guide</Link> walks through every screen for all three roles.
        </p>
        <p>
          We will use this blog to explain the decisions behind the product as we go. Some of them
          are more interesting than they look from the outside. The next post is about why a stamp
          is not a number.
        </p>
      </>
    ),
  },

  {
    slug: 'two-taps-mid-queue',
    title: 'Two taps, mid-queue: designing the counter console',
    excerpt:
      'The counter is where loyalty programs die. Here is how the staff console handles scanning, search, enrolment and mistakes without slowing the line.',
    date: '2026-08-26',
    category: 'Product',
    readingMinutes: 6,
    cover: {
      src: '/screens/staff-console.png',
      alt: 'Stamposa staff console on a phone showing customer search and add-stamp buttons',
      phone: true,
    },
    Body: () => (
      <>
        <p>
          Every decision in the staff console comes from one scene. It is Saturday morning. There
          are six people in the queue. The person at the front wants a stamp. Whatever the software
          asks of the staff member right now has to be faster than reaching for a hole punch.
        </p>
        <p>
          That scene rules out most of what a loyalty app normally does. No dashboard on the way in.
          No menu to navigate. No “are you sure?” on the common path. The console is one screen,
          and the screen is mostly a search box.
        </p>

        <h2>Finding the customer</h2>
        <p>
          The customer’s card carries a QR code. Tap <code>Scan card QR</code>, point the phone at
          their screen, and the card opens. Scanning runs in the browser using the phone’s camera,
          on iPhone and Android, with nothing to install.
        </p>
        <p>
          When scanning is awkward, because the customer has their phone in a bag or the light is
          bad, the same search box takes a phone number, a name, or the short customer code printed
          on the card. Before you have typed anything, it shows the people stamped most recently,
          which covers the regular who was just in yesterday.
        </p>

        <h2>Adding the stamp</h2>
        <p>
          On the customer’s card there is one large button: <code>Add stamp</code>. Tapping it
          records the stamp, animates the grid, and pushes the update to the customer’s own phone
          within a couple of seconds. If they have the card in Apple Wallet or Google Wallet, the
          pass updates as well.
        </p>
        <p>
          There is a daily cap on stamps per customer, set by the owner, so a bored teenager cannot
          give their friend a free coffee by tapping ten times. The console shows a message when
          the cap is hit rather than silently ignoring the tap.
        </p>

        <Shot
          src="/screens/staff-console.png"
          alt="The staff console showing a found customer and the large Add stamp button"
          caption="One customer, one button. The undo appears where the button was, with a countdown."
          phone
        />

        <h2>Undoing a mistake</h2>
        <p>
          People tap the wrong customer. It happens more on a busy morning, exactly when there is
          no time to phone the manager. So the console handles it in place: for 60 seconds after
          stamping, an <code>Undo</code> button with a countdown replaces the stamp button.
        </p>
        <p>
          Staff can undo only their own most recent stamp, and only inside that minute. Managers
          get 15 minutes and can undo any recent stamp at the counter. Both limits are deliberate:
          long enough to fix a slip, short enough that undo cannot become a way of quietly editing
          history. The next post explains what an undo actually does to the record.
        </p>

        <h2>Enrolling someone new</h2>
        <p>
          The normal way to join is for the customer to scan the standee and verify their number.
          But some customers would rather you did it, and some just want their first stamp now. Tap{' '}
          <code>New customer</code>, type their phone number or email, optionally their name, and
          they are enrolled. Leave <code>Add their first stamp right away</code> ticked and the stamp goes on
          in the same motion.
        </p>
        <p>
          Nobody is sent a code at the counter. The staff member is vouching for the number, and
          the customer claims the card the first time they sign in with it. Marketing consent is
          recorded only if the customer explicitly says yes, and the console never pre-ticks it.
        </p>

        <h2>Handing over a reward</h2>
        <p>
          When a card fills, a <code>Reward unlocked</code> banner appears with a{' '}
          <code>Hand over now</code> button, and a fresh card starts underneath so the next visit
          still earns a stamp. The confirmation shows the customer’s name, the reward and the
          voucher code, so a hand-over is a deliberate second tap rather than a side effect of the
          stamp.
        </p>
        <p>
          Rewards that were not handed over on the spot stay waiting. Any later visit shows a{' '}
          <code>Redeem</code> button on the card, and the owner sees the same voucher under{' '}
          <code>Waiting</code> on their rewards page.
        </p>

        <h2>The things that are missing on purpose</h2>
        <ul>
          <li>
            <strong>No sign-up for staff.</strong> The owner or a manager creates the login with an
            email and a password. There is nothing for a new hire to register.
          </li>
          <li>
            <strong>No settings.</strong> Brand colour, reward text and the daily cap live in the
            owner’s panel. The console shows the card as the customer sees it and nothing more.
          </li>
          <li>
            <strong>No numbers except today’s.</strong> The strip at the top shows your stamps and
            hand-overs today. Managers also see the whole counter and a per-teammate split. Trends
            and history belong to the owner.
          </li>
        </ul>

        <Callout tone="tip" title="Shared phones">
          If the counter shares one phone, the key icon in the header lets each staff member change
          their own password, and <code>Exit</code> signs out cleanly. Every stamp is recorded
          against the person who was signed in, so it is worth the extra tap at shift change.
        </Callout>
      </>
    ),
  },

  {
    slug: 'a-stamp-is-a-ledger-entry',
    title: 'Why a stamp is a ledger entry, not a number',
    excerpt:
      'The obvious way to build a stamp card is a counter you increment. We built an append-only ledger instead, and every undo, correction and analytics figure follows from that choice.',
    date: '2026-08-28',
    category: 'Engineering',
    readingMinutes: 7,
    Body: () => (
      <>
        <p>
          The obvious data model for a stamp card is a number. Each customer has a{' '}
          <code>stamps</code> column; a stamp adds one, a reward resets it to zero. It is what a
          spreadsheet would do, and it is what the paper card does.
        </p>
        <p>
          We did not build it that way, and the reason is not academic. A counter cannot answer the
          questions an owner actually asks. Who gave this customer twelve stamps on a Tuesday? Was
          that reward earned or was the balance adjusted? What happened to the stamp that was there
          an hour ago? With a counter, the answer to all three is a shrug.
        </p>

        <h2>Every stamp is a row</h2>
        <p>
          In Stamposa, a stamp is a row in a ledger that is only ever appended to. Each row carries
          a signed amount, who issued it, why, and when. A normal stamp is <code>+1</code> from a
          staff member. A reward completion is recorded against the specific row that filled the
          card. A customer’s balance is not stored anywhere; it is the sum of their rows.
        </p>
        <p>
          That one decision means the ledger is the truth and everything else is a view of it. The
          number on the customer’s card, the count on the dashboard, and the analytics for last
          month are all derived from the same rows, so they cannot disagree with each other.
        </p>

        <h2>Undo does not delete</h2>
        <p>
          When a staff member undoes a stamp within their 60-second window, nothing is removed.
          The original row is marked as undone, and a matching <code>−1</code> reversal is appended
          next to it. The balance goes back to where it was, and the record now shows that a stamp
          was added at 10:41 and reversed at 10:42 by the same person.
        </p>
        <p>
          The rules around undo fall out of the ledger naturally:
        </p>
        <ul>
          <li>Only the newest standing row can be undone. Reversals and already-undone rows are skipped.</li>
          <li>Staff may undo their own last stamp within 60 seconds. Managers may undo any stamp within 15 minutes.</li>
          <li>
            If the stamp being undone was the one that completed a card, the voucher it minted is
            voided. If that voucher has already been handed over, the undo is refused, because you
            cannot un-give a coffee.
          </li>
        </ul>
        <p>
          The last rule is the kind of thing a counter model gets wrong silently. Decrement the
          number and the customer has nine stamps and a free coffee. The ledger makes the conflict
          visible, so the software can say no.
        </p>

        <h2>Corrections are rows too</h2>
        <p>
          Owners sometimes need to fix a balance: a customer migrating from a paper card, or a
          stamp that was missed last week. That is an adjustment row, with a signed amount and a
          reason the owner has to type. It appears in the ledger exactly like a stamp does, tagged
          as an adjustment, so nobody later mistakes it for a visit.
        </p>
        <p>
          Adjustments also do not count towards the daily stamp cap. The cap is there to stop
          over-stamping at the counter, so it only looks at positive rows from staff that have not
          been undone in the last 24 hours. An owner correcting a balance is not the thing the cap
          exists to prevent.
        </p>

        <h2>Rewards are vouchers</h2>
        <p>
          When a card fills, the same transaction that records the completing stamp also mints a
          voucher with a short code and a snapshot of the reward text at that moment. If the owner
          later changes the reward from a coffee to a pastry, customers who already earned a coffee
          still get a coffee.
        </p>
        <p>
          A voucher is <code>waiting</code> until the counter hands it over, at which point it is{' '}
          <code>redeemed</code> with the time and the staff member recorded. A completion undo
          flips it to <code>void</code>. These transitions are guarded so two staff members
          confirming the same hand-over at the same moment cannot both succeed.
        </p>

        <h2>Analytics that survive corrections</h2>
        <p>
          Because undo is a reversal row rather than a deletion, analytics simply sum the signed
          amounts over the period. A stamp that was added and undone contributes <code>+1</code>{' '}
          and <code>−1</code> and nets to zero. The staff leaderboard works the same way, so a
          staff member cannot inflate their count by stamping and undoing.
        </p>
        <p>
          The same is true for the CSV export. What the owner downloads is the ledger, with the
          reversal rows included, not a cleaned-up summary. If they want to audit a month, the data
          to do it is in the file.
        </p>

        <Callout title="What the owner sees">
          The <code>Transactions</code> page in the merchant panel is this ledger, unfiltered. Every
          stamp, reversal and adjustment, with the person and the reason, and an{' '}
          <code>Export CSV</code> button. It is deliberately boring. That is the point.
        </Callout>

        <h2>Tenancy, briefly</h2>
        <p>
          One more invariant worth stating: which shop a row belongs to is always taken from the
          signed-in staff member or owner, never from anything the browser sends. A request that
          reaches for another shop’s customer gets a not-found, not a permission error, because we
          would rather not confirm the customer exists at all.
        </p>
      </>
    ),
  },

  {
    slug: 'numbers-you-can-trust',
    title: 'Analytics you can trust, and data you can take with you',
    excerpt:
      'What the merchant dashboard counts, why day boundaries follow your timezone, and why exporting your own customer list is not a premium feature.',
    date: '2026-08-30',
    category: 'Product',
    readingMinutes: 5,
    cover: {
      src: '/screens/merchant-analytics.png',
      alt: 'Stamposa analytics showing stamps, new customers, repeat rate and a daily activity chart',
    },
    Body: () => (
      <>
        <p>
          A loyalty program is worth running if people come back more than they otherwise would.
          Everything on the analytics page exists to answer that question honestly, which mostly
          means resisting the temptation to make the numbers look good.
        </p>

        <Shot
          src="/screens/merchant-analytics.png"
          alt="Stamposa analytics showing stamps, new customers, repeat rate and a daily activity chart"
          caption="Stamps, new customers and repeat rate for the period, each against the period before."
        />

        <h2>What is counted</h2>
        <ul>
          <li>
            <strong>Stamps</strong> is the net figure for the period: stamps added minus stamps
            undone. A stamp that was reversed a minute later does not count.
          </li>
          <li>
            <strong>New customers</strong> is people who joined in the period, whether they scanned
            the QR themselves or were enrolled at the counter.
          </li>
          <li>
            <strong>Repeat rate</strong> is the share of your customers who have come back for a
            second stamp. It is the number to watch. If it is not moving, the program is not
            working, whatever the stamp total says.
          </li>
          <li>
            <strong>Rewards</strong> splits into earned and handed over, because a reward that was
            earned but never collected is a different kind of signal.
          </li>
        </ul>
        <p>
          Each figure shows the same period immediately before it, over 7, 30 or 90 days, so a
          number always comes with the context of whether it went up or down.
        </p>

        <h2>Your day, not the server’s</h2>
        <p>
          A shop that closes at 1 a.m. has a Friday night that ends on Saturday. If the software
          counts days in UTC, that night gets split in two and both halves look quiet. Every
          Stamposa merchant sets a timezone in settings, and every daily figure, chart bucket and
          “today” on the dashboard uses it.
        </p>
        <p>
          The same setting drives the busiest-days chart, so the bar for Friday is your Friday.
        </p>

        <h2>The dashboard is live</h2>
        <p>
          The home screen refreshes itself every 15 seconds. Four cards at the top show customers,
          stamps today, rewards earned and rewards waiting, and beneath them a feed of stamps as
          they happen at the counter, with the staff member’s name. An owner who is not in the
          shop can still see it working.
        </p>

        <Shot
          src="/screens/merchant-dashboard.png"
          alt="Stamposa merchant dashboard showing today’s stamps, live activity and campaign status"
          caption="Today at a glance, with the live feed underneath."
        />

        <h2>The list is yours to take</h2>
        <p>
          The customer list, with names, contact details, stamp counts and last-visit dates, exports
          to CSV from the customers page. So does the full transaction ledger. There is no tier
          where this is switched on. If you leave Stamposa, you leave with your customers.
        </p>
        <p>
          The export carries phone and email as separate columns, and a customer’s consent record,
          with the exact wording they agreed to and the channel they agreed on, sits on their
          profile. If you send marketing, you can show what each person opted into.
        </p>

        <Callout title="Erasure">
          When a customer asks to be forgotten, their record is anonymised in place: name and
          contact details are removed, and their stamp history is kept as anonymous rows so your
          totals stay correct. The ledger is not rewritten, and the person is no longer in it.
        </Callout>
      </>
    ),
  },

  {
    slug: 'join-with-phone-or-email',
    title: 'Join with a phone number or an email, whichever you have',
    excerpt:
      'Customers can now sign in with a one-time code sent to either a phone number or an email address. What changed, and what to know when you enrol someone at the counter.',
    date: '2026-09-01',
    category: 'Update',
    readingMinutes: 4,
    cover: {
      src: '/screens/join-page.png',
      alt: 'The Stamposa join page a customer sees after scanning the shop’s QR code',
      phone: true,
    },
    Body: () => (
      <>
        <p>
          Until this week a Stamposa card was tied to a phone number. Scanning the QR asked for a
          number, a code arrived by SMS, and that was the customer’s identity from then on. As of
          today the join page accepts an email address in the same box, and the code arrives by
          email instead.
        </p>

        <Shot
          src="/screens/join-page.png"
          alt="The Stamposa join page with a single field that accepts a phone number or an email"
          caption="One field. Type a number or an address; the code goes wherever you typed."
          phone
        />

        <h2>Why</h2>
        <p>
          Two reasons. Some customers would simply rather not give a shop their phone number, and a
          loyalty card is not worth an argument at the counter. And SMS delivery in some countries
          depends on regulatory registration that takes time to approve, while email works
          everywhere on day one. Offering both means a shop can go live now and let customers pick.
        </p>

        <h2>How it works</h2>
        <ul>
          <li>
            The join page and <Link href={appHref('/my-cards')}>My cards</Link> have one field.
            Anything containing an <code>@</code> is treated as an email; anything else is treated
            as a phone number.
          </li>
          <li>
            Phone numbers are normalised to international format and emails are lower-cased before
            anything is stored, so <code>Priya@example.com</code> and{' '}
            <code>priya@example.com</code> are the same customer.
          </li>
          <li>
            The one-time code is six digits, expires in five minutes, and is rate-limited per
            person, not per channel. Switching from phone to email does not reset the limit.
          </li>
          <li>Sign-in emails are a branded template with a plain-text fallback, so they read correctly in any client.</li>
        </ul>

        <h2>What owners see</h2>
        <p>
          Customer lists and profiles show a single <strong>contact</strong> column, which is the
          phone number if there is one and otherwise the email. The CSV export keeps them as two
          separate columns so nothing is lost. Counter enrolment accepts either as well, and the
          customer opens their card later by signing in with whichever the staff member typed.
        </p>

        <Callout tone="tip" title="One identity per customer">
          A customer who is enrolled at the counter by phone and later joins the same shop by email
          becomes two customers with two cards. There is no merge tool yet. If a regular has a card
          already, ask which contact they used rather than enrolling them again.
        </Callout>

        <h2>Nothing changes for staff and owners</h2>
        <p>
          Staff and owners continue to sign in with email and password. Only the customer path is
          affected, and existing phone-number customers keep working exactly as before.
        </p>
      </>
    ),
  },

  {
    slug: 'wallet-passes-that-show-progress',
    title: 'Your loyalty card, next to your boarding pass',
    excerpt:
      'Apple Wallet and Google Wallet passes are live. Each one shows the stamp card itself, in the shop’s colours, and updates on the phone after every stamp.',
    date: '2026-09-02',
    category: 'Update',
    readingMinutes: 5,
    cover: {
      src: '/screens/customer-card.png',
      alt: 'A Stamposa customer card showing Add to Apple Wallet and Save to Google Wallet buttons',
      phone: true,
    },
    Body: () => (
      <>
        <p>
          The customer card has always lived in the browser, which is what lets people join without
          installing anything. But a browser tab is not where people keep the things they show at
          a counter. That place is the wallet app, next to the boarding passes and the cinema
          tickets. As of this week, a Stamposa card can live there too.
        </p>

        <h2>One tap from the card</h2>
        <p>
          Every customer card now has <code>Add to Apple Wallet</code> and{' '}
          <code>Save to Google Wallet</code> buttons. Tapping one hands the phone a pass in the
          shop’s brand colour, with the shop’s logo, the customer’s name and their stamp count.
          The barcode on the pass is the same customer code the counter console scans, so staff
          treat it exactly like the card in the browser.
        </p>

        <Shot
          src="/screens/customer-card.png"
          alt="A Stamposa customer loyalty card on a phone with stamps, QR code and wallet buttons"
          caption="The card in the browser, with the two wallet buttons beneath the QR panel."
          phone
        />

        <h2>The pass shows the card</h2>
        <p>
          Most loyalty passes are a logo and a number. We wanted the pass to look like the thing it
          replaces, so the banner across the top of each pass is the punch card itself: a filled
          disc for every stamp collected and a ring for every one still to go, wrapping onto a
          second row for programs with more than six stamps. It is drawn fresh for each customer on
          each stamp, on the shop’s brand colour, and the ink flips to dark automatically on light
          brands so it stays readable.
        </p>
        <p>
          On Apple Wallet the banner is baked into the pass and the count sits in the header. On
          Google Wallet it is the hero image, which Google fetches from us each time the count
          changes.
        </p>

        <h2>It stays current</h2>
        <p>
          When staff add a stamp, the pass updates. Apple Wallet passes receive a push and refresh
          within seconds; Google Wallet passes are updated directly. The number in the customer’s
          wallet is never the number from last visit. The same happens on undo, so a reversed stamp
          disappears from the pass as well.
        </p>

        <h2>What a shop needs to do</h2>
        <p>
          Nothing. Wallet passes are on for every program. The logo and brand colour come from the
          shop’s settings, so a shop that has uploaded a logo sees it on the pass immediately. A
          shop without one gets a neutral Stamposa mark until it adds its own.
        </p>

        <Callout title="Availability">
          Apple Wallet passes install on any iPhone. Google Wallet passes are currently in Google’s
          testing mode while we complete publishing review, so they open for a limited set of
          accounts until that finishes. We will note here when it does.
        </Callout>

        <h2>The card in the browser is still the card</h2>
        <p>
          The wallet pass is a convenience, not a replacement. The browser card remains the place
          to see the full history, claim a reward and find every shop’s card under{' '}
          <Link href={appHref('/my-cards')}>My cards</Link>. Customers who never touch the wallet
          buttons lose nothing.
        </p>
      </>
    ),
  },
];

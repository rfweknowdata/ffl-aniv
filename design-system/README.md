# Fiat Lux — Postais de Aniversário

Tooling to help the **Fraternidade Fiat Lux** church send a birthday postcard to each
member on their anniversary. This repo holds the **design** (postcard + admin backoffice)
that a developer (e.g. Claude Code) will wire up into a small working application.

---

## The goal

Today the process is manual: someone opens a Word file, edits the member's name(s) and the
date by hand, exports to PDF, and emails it. We want to **automate** that:

1. Keep every member in a **SQLite database**.
2. Give an admin a simple **backoffice** to manage members and see who gets a postcard when.
3. On each member's birthday, **generate the postcard** (same design as the original Word file)
   and deliver it:
   - **By e-mail — automatically** if the member has an e-mail address.
   - **By WhatsApp — manually** if the member has only a phone number: the admin
     downloads the postcard PDF and sends it themselves.

The two `.dc.html` files in this repo are the **visual source of truth**. They open directly
in a browser. The developer should reproduce these exactly in the real app (the postcard is
pixel-faithful to the church's original; the admin defines the intended UI and behavior).

---

## Files

| File | What it is |
|---|---|
| **`Canvas.dc.html`** | The **admin backoffice** — members table with full CRUD, and a scheduling page. Working prototype (data is in-memory mock). |
| **`Postal Aniversario.dc.html`** | The **postcard**, live-editable (name, mystic name, date, text scale, print guides). Pixel-faithful to the church's Word/PDF original. |
| **`automation/postal-aniversario.template.html`** | The postcard as a plain, self-contained A4 HTML page with **find-&-replace tokens**. This is what the automation fills in per member. |
| **`assets/fundo-postal-aniv.png`** | The floral background. The logo, org name and "Feliz Aniversário" are **baked into the image** — fixed for every postcard. |
| `uploads/FFL/` | The originals the church provided (Word, exported PDFs, member spreadsheet/CSV). Reference only. |

---

## Data model (member)

Field **names are English in code, displayed in Portuguese (pt-PT)** in the UI. Suggested
SQLite columns:

| Column (code) | UI label (pt-PT) | Type / notes |
|---|---|---|
| `internalId` | ID Interno | text, unique — e.g. `FFL-001` |
| `profaneName` | Nome Profano | text, **required**, stored uppercase |
| `mysticName` | Nome Místico | text, optional (may be empty) |
| `birthDate` | Data de Nascimento | ISO `YYYY-MM-DD` |
| `nif` | NIF | text (9 digits, PT tax id) |
| `phoneNumber` | Telemóvel | text, e.g. `+351 9XX XXX XXX` |
| `email` | E-mail | text, optional |
| `notes` | Observações | text, optional |

### Channel rule (how each member is contacted)

Centralized as one function in the prototype (`channelOf`):

1. Has a non-empty **`email`** → **E-mail (automatic)**.
2. Else has a non-empty **`phoneNumber`** → **WhatsApp (manual — download PDF)**.
3. Neither → **Sem contacto** (no channel; nothing is sent).

---

## The admin backoffice (`Canvas.dc.html`)

Light, ivory-and-gold theme (the church is centered on *light* — "Fiat Lux").

**Mobile-first** — the app is designed primarily for use on an **iPhone**:
- On phones the sidebar is a **collapsible drawer**: hidden by default, opened from a
  hamburger in a sticky top bar, slides in over a dimmed overlay (tap outside or the X to
  close; navigating auto-closes it).
- The members list renders as **tap-friendly cards** instead of a table, with large
  (≥42px) PDF / edit / delete buttons; search goes full-width and a gold **+** in the top
  bar adds a member.
- The edit modal collapses to a **single column** and docks to the bottom of the screen.
- On wider screens it automatically expands to the **desktop layout** (static sidebar +
  full table). The switch is driven by viewport width and updates live on resize/rotate
  (breakpoint: 760px). Reproduce this as responsive/adaptive layout in the real app.

**Sócios (Members)**
- Table: Nome Profano (+ internal id), Nome Místico, Nascimento, NIF, Telemóvel, E-mail,
  Canal (auto-derived badge), Ações.
- **Search** across name / mystic name / e-mail / NIF / id.
- **CRUD**: add, edit (modal with all fields), delete (with confirmation).
- Per-row **Descarregar PDF** — generates that member's postcard, filled and print-ready.

**Agendamentos (Scheduling)**
- This year's birthdays grouped into **Hoje / Próximos / Enviados**.
- Each row shows the channel and status; WhatsApp members get a **PDF** download button.
- In the prototype, "sent vs upcoming" is derived purely from the date relative to today.
  In the real app this should reflect actual send state stored in the DB (see below).

---

## The postcard tokens

Inside `automation/postal-aniversario.template.html`, replace these literal strings:

| Token | Meaning | Example |
|---|---|---|
| `{{nome_profano}}` | Full profane name (usually uppercase) | `ISABEL MARIA ANDRADE SILVEIRINHA SILVA` |
| `{{nome_mistico}}` | Mystic name — **replace with `""`** if none; the "Nome Místico" label stays either way | `THARYH` |
| `{{data}}` | Postcard date, Portuguese, capitalized month | `18 de Junho de 2026` |

Everything else (the blessing "*Eu Doménico de Roma…*", "Namastê", the background) is fixed.

### Date format

`<dia> de <Mês> de <ano>`, month capitalized in Portuguese, using the **current year** with
the member's birthday day/month:

```
Janeiro Fevereiro Março Abril Maio Junho
Julho Agosto Setembro Outubro Novembro Dezembro
```

Day is not zero-padded in the original ("18 de Junho de 2026").

### Design specifics (for faithful reproduction)

- Page: **A4 portrait**, no margins, background printed full-bleed.
- Font: **Times New Roman** (serif).
- Labels ("Nome Profano" / "Nome Místico") and the blessing/date: **gold `#CC9900`, italic**.
- The name values: **blue `#9CC2E5`**.
- The exact positions/sizes are in `automation/postal-aniversario.template.html`.

---

## Suggested automation flow (for Claude Code)

1. **Seed the DB** from `uploads/FFL/` (the `…SociosAtivos.csv` / `Sócios Ativos …xlsx`):
   map to the columns above.
2. **Daily job**: find members whose `birthDate` day+month equals today.
3. For each, build the postcard: copy the template, string-replace the three tokens,
   write a temp `.html` (keep `assets/` reachable, or inline the PNG as a base64 `data:` URI
   for a fully portable file).
4. **Render**:
   - **PDF** — headless Chrome print (page is already A4, no margins):
     `page.pdf({ printBackground: true, preferCSSPageSize: true })`.
   - **PNG** (optional) — screenshot the `.postal` element (≈ 2480×3508 px at 300 dpi).
5. **Deliver** per the channel rule:
   - E-mail → attach the PDF and send automatically.
   - WhatsApp → surface the PDF in the admin for the admin to download and send by hand.
6. **Record** the send (member id, date, channel, status) so the Agendamentos page can show
   real *Enviado* vs *Agendado* state and avoid duplicate sends.

---

## Notes / open items

- The prototype data is in-memory; nothing persists yet — that's the real app's job.
- Consider a **"marcar como enviado"** action and a per-year send log in the DB.
- Consider **CSV/XLSX import** to seed and refresh the member list from the church's sheet.
- The `.dc.html` files reference the background at `assets/fundo-postal-aniv.png` — keep that
  path, or update it when porting into the app's asset pipeline.

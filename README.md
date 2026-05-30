# NAP XML Generator

Browser-based application that generates Bulgarian NRA (NAP) XML audit files from Shopify CSV exports. All processing runs locally in the browser — no backend, database, or file uploads to a server.

## Features

- Upload Shopify order CSV exports
- Parse and map orders to the NAP `audit` XML structure (per `dec_audit.xsd`)
- Generate pretty-printed UTF-8 XML
- Validate structure, required fields, hierarchy, and data types
- Preview and download the generated XML file

## Tech stack

- React 18
- Vite 6
- JavaScript (ES modules)
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- [xmlbuilder2](https://github.com/oozcitak/xmlbuilder2) — XML generation

## Project structure

```
src/
  components/       UI components (upload, validation, download)
  services/         CSV parsing, mapping, XML generation, validation
  utils/            Helpers and schema definitions derived from dec_audit.xsd
  App.jsx           Main application
  main.jsx          Entry point
public/
  dec_audit.xsd     NRA reference schema
  vik_simple.xml    NRA reference example
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Build

```bash
npm run build
```

Static output is written to the `dist/` folder.

Preview the production build locally:

```bash
npm run preview
```

## Usage

1. Fill in the **Shop configuration** section:
   - **EIK** — company identifier (9–13 characters)
   - **E-shop number** — NAP-assigned shop ID (`e_shop_n`, max 10 chars)
   - **Domain name** — your shop URL
   - **E-shop type** — `1` (own domain) or `2` (platform such as Shopify)
   - **Creation date** — file creation date
   - **Report month/year** (optional) — defaults from order dates

2. Export orders from Shopify Admin as CSV (include line item columns).

3. Upload the CSV file.

4. Review the processing summary, validation results, and XML preview.

5. Click **Download XML** when validation passes.

## Shopify CSV requirements

The parser expects standard Shopify order export columns. At minimum:

| Purpose        | Column names accepted                          |
|----------------|------------------------------------------------|
| Order number   | `Name`, `Order Name`                           |
| Order date     | `Created at`                                   |
| Line item name | `Lineitem name`                                |

Additional columns improve mapping accuracy: `Lineitem quantity`, `Lineitem price`, `Subtotal`, `Taxes`, `Total`, `Discount Amount`, `Payment Method`, `Financial Status`.

## XML structure

Generated files follow the NRA audit schema:

```
audit
├── eik, e_shop_n, domain_name, e_shop_type
├── creation_date, mon, god
├── order
│   └── orderenum (per order)
│       ├── ord_n, ord_d, doc_n, doc_date
│       ├── art → artenum (line items)
│       ├── ord_total1, ord_disc, ord_vat, ord_total2
│       └── paym (+ optional pos_n, trans_n, proc_id)
└── [optional returns: r_ord, rorder, r_total]
```

Reference files in `public/` (`dec_audit.xsd`, `vik_simple.xml`) are used as specification material. Validation rules in `src/utils/schema.js` are derived from the XSD.

## Deploy to Vercel

This project is a static Vite frontend. No server-side code is required.

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Vercel detects Vite automatically.

### Option B — Git integration

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Use these settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Deploy.

The included `vercel.json` configures SPA routing for client-side navigation.

## Privacy

All CSV parsing, mapping, XML generation, and validation happen in the user's browser. No data is sent to external servers.

## License

Private / internal use.

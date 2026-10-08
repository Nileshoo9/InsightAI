# InsightAI — AI-Powered Intelligent Data Analysis and Visualization System

InsightAI is a modular, dataset-driven analytics application built for a final-year engineering project. It accepts CSV, JSON, and Excel files, validates and profiles the structure, cleans and diagnoses data quality issues, detects the likely domain, selects relevant KPIs, and generates deterministic reports with optional AI narration for explanation.

## 1. Project Overview

The project focuses on making data analysis more accessible to users who are not data specialists. Instead of assuming that every dataset is a sales file, the system adapts to the structure it sees: education, healthcare, HR, finance, sales, or general analytics.

## 2. Problem Statement

Manual analysis usually requires several stages that are repetitive and error-prone:

- dataset upload and validation
- parsing inconsistent files
- cleaning missing and invalid values
- profiling columns and statistics
- detecting domain-specific patterns
- selecting meaningful KPIs
- visualizing the right chart types
- turning results into explainable insights

InsightAI automates these stages while keeping the statistical logic deterministic and explainable.

## 3. Objectives

- support generic datasets, not only sales data
- keep full raw data separate from preview data
- detect domain and semantic columns using dataset signals
- calculate analytics deterministically before calling the AI layer
- protect authentication and authorization boundaries
- provide a report that still works when AI is unavailable

## 4. System Architecture

```text
Upload
  ↓
Parser
  ↓
Cleaner
  ↓
Profiler
  ↓
Domain Detection
  ↓
Deterministic Analytics Engine
  ↓
Visualization Selection
  ↓
AI Insight Layer (explanatory only)
  ↓
Dashboard / Report / NLQ
```

## 5. Key Modules

- File Upload: secure multipart upload with size and format validation
- Parsing: CSV, JSON, and Excel ingestion with normalization
- Cleaning: whitespace normalization, missing-value detection, duplicate removal, invalid-value checks
- Profiling: row counts, column metadata, semantic detection, numeric summaries
- Data Quality: completeness, validity, uniqueness, and duplicate-rate diagnostics
- Domain Detection: education, healthcare, HR, finance, sales, and general analytics
- Analytics: correlation, trends, distributions, grouping, and anomaly checks
- Visualization: chart selection based on data structure
- AI Insights: Gemini-backed explanation layer with deterministic evidence as the source of truth
- Report Generation: domain-aware KPI and findings summary
- NLQ: user query interpretation with validated filters and deterministic aggregation

## 6. Supported Formats

- CSV
- JSON array/object with a data array
- XLSX and XLS

The application is designed for tabular dataset workflows and does not assume a single business domain.

## 7. Supported Domains

The implemented model prioritizes five strong domains:

1. Sales / Retail
2. Education
3. Healthcare
4. HR / Workforce
5. Finance

When the schema is not a strong match, the system falls back to General Analytics.

## 8. Technology Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL-compatible database
- JWT-based authentication with bcrypt
- Papa Parse + xlsx for file parsing
- Gemini API for optional narrative enrichment
- Recharts for dashboard/chart rendering

## 9. AI + Deterministic Analytics Architecture

This is an important viva concept for the project:

```text
Dataset
  ↓
Deterministic analytics engine
  ↓
Validated metrics, distributions, and findings
  ↓
Gemini / AI explanation layer
  ↓
Final report or dashboard summary
```

The AI layer does not calculate authoritative metrics. It explains context already computed by the code. If the evidence is weak or the provider fails, the deterministic report remains available.

## 10. Installation

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:push
npm run dev
```

On Windows, use:

```powershell
copy .env.example .env
```

## 11. Environment Variables

Use placeholders only and keep secrets server-side.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
JWT_SECRET="replace-with-a-long-random-secret-of-at-least-32-characters"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.0-flash"
AI_PROVIDER="gemini"
```

Never commit real credentials. Never expose them to client-side code.

## 12. Testing

```bash
npm test
```

The project includes tests covering parsing, diagnostics, profile generation, domain detection, report construction, and architecture guardrails.

## 13. Limitations

- large datasets should be managed with explicit sample documentation when needed
- AI-generated explanations are support layers, not calculation engines
- complex causal claims require a dedicated causal model or experimental design
- highly unstructured or messy files may require manual cleanup before perfect results

## 14. Future Scope

- advanced predictive modelling
- more domain modules
- larger-scale data ingestion
- multilingual insight generation
- improved anomaly detection and automated remediation
- richer NLQ validation with field-level schema understanding

## 15. Technical Documentation Summary

This project addresses a real problem: ordinary dataset analysis is usually fragmented across manual cleaning, visualization, and interpretation. InsightAI consolidates those stages into a single explainable workflow.

### Problem
Manual data work is slow, inconsistent, and expensive for students, researchers, and small teams.

### Existing Limitations
Many generic tools either assume a single domain or produce opaque results without evidence.

### Proposed System
A dataset-driven analytics platform that validates inputs, profiles data, selects relevant KPIs, and explains what the numbers mean.

### Architecture
The system separates deterministic analysis from AI explanation, which is essential for academic demonstration, trust, and correctness.

### Methodology
- ingest and normalize raw rows
- detect semantic and domain signals
- compute statistics and quality tests
- build structured findings and visualizations
- optionally enrich explanation with Gemini

### Implementation
The repository uses a modular monolith approach to keep the project understandable and demonstrable during viva evaluation.

### Testing
Validation includes parser checks, domain detection, KPI selection, and end-to-end report generation tests.

### Results
The system is able to adapt across a variety of dataset structures while staying explainable and defensible.

### Limitations
AI is used selectively and does not replace deterministic analytics.

### Future Scope
This project can be extended with more advanced analytics, deeper NLP, and additional domain logic.

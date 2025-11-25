# Surebet Management System

## Overview

A comprehensive web application for managing and tracking surebet operations. It features automated OCR PDF processing for extracting betting data, managing dual-bet scenarios (one bet wins, other loses), and streamlining the workflow from data entry to profit tracking and reporting. The system supports bulk operations and aims to reduce manual errors and processing time.

## User Preferences

Preferred communication style: Simple, everyday language.

**Default Management Page Filters**:
- Management page always opens with "Pendente" status filter pre-selected
- "Ordenar por Data" button is always active by default
- User can still change filters manually after opening the page

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (SPA)
- **Routing**: Wouter
- **UI**: Shadcn/ui (Radix UI + Tailwind CSS), Material Design adaptation with betting-specific color schemes
- **State Management**: TanStack Query (server state), React hooks (local state)
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with custom CSS variables (light/dark modes)

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **API**: RESTful
- **File Handling**: Multer (for image uploads, 10MB limit)
- **Error Handling**: Centralized middleware
- **Development**: Vite for HMR

### Data Storage
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM (type-safe queries, migrations)
- **Schema**: Normalized structure for account holders, betting houses, surebet sets, and individual bets. Uses Decimal for financial calculations and UUID for primary keys.

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL store (connect-pg-simple)
- **Security**: CORS, secure session cookies
- **Access Control**: Route-level protection (planned)

### Key Architectural Decisions
- **OCR-First Data Entry**: Prioritizes automated data extraction from PDFs using `pdfplumber` to reduce manual entry and errors.
- **Dual & Triple-Bet Structure**: Models each surebet as a set of 2 OR 3 opposing bets across different houses, ensuring guaranteed profit regardless of outcome. System fully supports both formats.
- **Progressive Enhancement**: Core functionality is available, with OCR automation enhancing the user experience.
- **Financial Precision**: Uses decimal data types (10,2 for amounts, 8,2 for odds) to prevent floating-point errors.
- **Responsive Design**: Mobile-first approach with adaptable UI.
- **Timezone Handling**: Preserves event dates/times as entered by users without UTC conversion across the stack.
- **Performance Optimization**: Implemented batch queries with `inArray` and strategic database indexes to optimize data fetching.
- **Real-time Search**: Instant, case-insensitive, accent-insensitive search on both Dashboard and Management pages.
- **Dashboard Visual Redesign**: Dedicated visual analytics page with summary cards and an interactive cumulative profit line chart (Recharts), independent of bet management.
- **Bet Position Stability**: Ensures stable bet ordering using deterministic SQL ordering (`ORDER BY createdAt ASC, id ASC`) to prevent position swaps.
- **"Meio Green" Feature**: Added functionality for resolving bets as "half won" or "half returned" with precise profit calculations.
- **New User Onboarding**: Batch upload automatically detects unmatched betting houses via `useMemo`, displays blocking alert with "quick create" button, creates default holder ("Titular Padrão") and all unmatched houses. Uses `createResource` helper for error handling, refetches queries to update dropdowns, surfaces backend errors with house names, handles partial failures gracefully.

## External Dependencies

- **OCR Processing**: `pdfplumber` (Python library for PDF text extraction)
  - Enhanced profit and bet type extraction.
  - Improved sport detection.
  - **November 17, 2025**: Fixed critical 3-bet extraction bug - parser now correctly extracts all 3 bets when present, breaking loop only after all detected bets are mapped.
- **Image Processing**: Base64 encoding for API transmission.
- **QR Code Reading**: `jsQR` library (client-side processing for QR codes).
- **BetBurger Integration**: Custom parser for BetBurger Excel data format with full system compatibility.
  - **November 2025**: Fixed critical submission bug - changed from TanStack mutation to direct fetch() matching batch-upload payload structure
  - Payload format: `{surebetSet: {...}, bets: [...]}` with all fields as strings and `status: "pending"`
  - 100% compatible with Management, Dashboard, graphs, and profit calculations
  - **November 17, 2025**: Enhanced parser with full localized format support:
    - Accepts accented Portuguese months (março, nov., etc.)
    - Supports Unicode separators (middle dot ·, en-dash –, em-dash —)
    - Handles Unicode dashes between team names
    - Automatically detects 2 vs 3 bet scenarios
  - **November 17, 2025**: Fixed atomic validation - system now validates ALL bets before submitting any, preventing partial submissions when some bets are incomplete
- **Database Hosting**: Neon (serverless PostgreSQL).
- **UI Components**: Shadcn/ui, Radix UI.
- **Development Tools**: Replit integration (runtime error overlay, cartographer).
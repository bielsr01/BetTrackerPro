# Design Guidelines for Surebet Management System

## Design Approach
**System Selected**: Material Design with data-focused adaptations
**Justification**: This is a utility-focused application prioritizing efficiency and data processing. The interface needs to handle complex workflows (OCR processing, dual-bet management) while maintaining clarity for financial data tracking.

## Core Design Elements

### A. Color Palette
**Primary Colors (Dark Mode)**:
- Background: 217 33% 17% (deep blue-gray)
- Surface: 217 25% 25% (elevated surfaces)
- Primary: 210 100% 70% (bright blue for CTAs)
- Success: 140 65% 55% (for winning bets)
- Error: 0 75% 65% (for losing bets)
- Warning: 45 95% 65% (for pending/returned bets)

**Light Mode**:
- Background: 0 0% 98% (near white)
- Surface: 0 0% 100% (pure white cards)
- Primary: 210 100% 50% (blue)
- Text: 217 33% 17% (dark blue-gray)

### B. Typography
**Font Family**: Inter (Google Fonts)
- Headers: 600 weight
- Body text: 400 weight
- Data/numbers: 500 weight (for emphasis on financial values)
- Small labels: 400 weight, slightly reduced opacity

### C. Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, and 8
- Component padding: p-4, p-6
- Section margins: m-6, m-8
- Element spacing: gap-2, gap-4
- Form field spacing: space-y-4

### D. Component Library

**Navigation**:
- Fixed sidebar with collapsible menu
- Clean icons with labels
- Active state highlighting

**Data Entry**:
- Large drag-and-drop upload area with dashed border
- Editable form fields with clear labels
- Two-column layout for dual-bet comparison
- Validation states with color coding

**Data Display**:
- Card-based layout for bet pairs
- Status badges (Pending/Won/Lost/Returned)
- Data tables with sorting capabilities
- Progress indicators for OCR processing

**Interactive Elements**:
- Primary buttons for main actions (Process Image, Save Bet)
- Secondary buttons for status changes
- Dropdown selectors for account holders and betting houses
- Date/time pickers for filtering

**Overlays**:
- Modal dialogs for account/house registration
- Toast notifications for OCR results and save confirmations
- Loading states during image processing

### E. Key Interface Sections

**Main Dashboard**:
- Clean data table showing bet pairs
- Filter panel with date ranges and status options
- Summary cards showing total profit/loss
- Quick action buttons for common tasks

**Upload Interface**:
- Prominent drop zone occupying most viewport
- Live preview of uploaded images
- OCR results display with editable extraction
- Side-by-side comparison of extracted vs. corrected data

**Test OCR Screen**:
- Simple image upload area
- Raw text extraction display
- Structured data parsing results
- Debug information for OCR accuracy

**Settings/Management**:
- Simple forms for account holder registration
- Minimal required fields (name + betting house)
- Optional fields clearly marked
- Bulk actions for managing multiple accounts

## Visual Hierarchy
- Financial data (odds, stakes, profits) emphasized with medium font weight
- Status indicators using color and typography
- Clear separation between bet pairs using cards/borders
- Consistent spacing for scanning efficiency

## Data Presentation
- Numerical values right-aligned in tables
- Currency formatting with consistent decimal places
- Clear profit/loss indicators with appropriate colors
- Date/time stamps in consistent format

This design prioritizes data clarity, efficient workflows, and error prevention while maintaining visual appeal appropriate for a professional betting management tool.
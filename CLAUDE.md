# St. Basil's Syriac Orthodox Church Website

## Overview
Static HTML website for St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serves the Jacobite Malayalee community in the New England region.

- **Address**: 73 Ellis Street, Newton, MA 02464
- **Domain**: stbasilsboston.org

## Technology Stack
- **Frontend**: Static HTML5, CSS3, JavaScript (no build step)
- **CSS Framework**: Bootstrap 5.3.3 (Squadfree template base)
- **Backend**: PHP contact forms (currently non-functional)
- **Hosting**: GoDaddy/Plesk (Windows/IIS)
- **CI/CD**: GitHub Actions deploying via FTP
- **Domain Management**: Vercel

## Project Structure

### Root HTML Pages (20 total)

**Active — linked from navigation (14):**
```
index.html              # Homepage
about.html              # Our History
spiritual-leader.html   # Our Spiritual Fathers
our-clergy.html         # Our Clergy
office-bearers.html     # Our Office Bearers
acolytes-choir.html     # Our Acolytes & Choir
our-organizations.html  # Our Organizations
events-calendar.html    # Events Calendar (custom JS calendar)
useful-links.html       # Useful Links
first-time.html         # First Time Visiting?
giving.html             # Giving / Donations
contact-us.html         # Contact Us
privacy-policy.html     # Privacy Policy (footer link)
terms-of-use.html       # Terms of Use (footer link)
```

**Orphaned — exist but not linked from navigation (4):**
```
sunday-school.html      # Replaced by our-organizations.html
stpauls-mensfellow.html # Replaced by our-organizations.html
stmarys-womens.html     # Replaced by our-organizations.html
youth.html              # Replaced by our-organizations.html
```

**Template — unused (2):**
```
portfolio-details.html  # Squadfree template page
starter-page.html       # Squadfree template page
```

### Key Directories
```
/assets/
├── css/main.css            # Primary stylesheet (2,352 lines)
├── js/main.js              # Primary script (210 lines)
├── img/                    # Images organized by page/section
├── PDFs/                   # Liturgical documents (12 PDFs)
├── scss/                   # SCSS source (Readme.txt only)
└── vendor/                 # Third-party libraries
    ├── aos/                # Animate On Scroll
    ├── bootstrap/          # Bootstrap 5.3.3
    ├── bootstrap-icons/    # Icon library
    ├── glightbox/          # Image/video lightbox
    ├── imagesloaded/       # Image load detection
    ├── isotope-layout/     # Masonry/grid filtering
    ├── php-email-form/     # Form validation JS (PHP library MISSING)
    ├── purecounter/        # Counter animations
    └── swiper/             # Touch slider/carousel

/forms/
├── contact.php             # Contact form handler (BROKEN - see Known Issues)
└── newsletter.php          # Newsletter handler (BROKEN - see Known Issues)

/.github/workflows/
├── deploy-main.yml         # Production deploy: push to main → FTP to /new_website/root/
└── deploy-staging.yml      # Staging deploy: PR to main → FTP to /preprod.stbasilsboston.org/
```

## Navigation Structure
```
Home
About (Dropdown)
  ├── Our History
  ├── Our Spiritual Fathers
  ├── Our Clergy
  ├── Our Office Bearers
  ├── Our Acolytes & Choir
  └── Our Organizations
Resources (Dropdown)
  ├── Events Calendar
  ├── Useful Links
  └── First Time Visiting?
Giving
Contact Us
```

## Service Times
- Morning Prayer: 8:30 AM EST (Sundays)
- Holy Qurbono: 9:15 AM EST (Sundays)

## Design System

### Colors (CSS Variables in main.css)
- `--accent-color`: #67b0d1 (light blue)
- `--heading-color`: #2f4d5a (dark blue-gray)
- `--default-color`: #444444 (body text)
- Header/Nav background: #FEFAE0 (cream)
- Accent sections: #91203C (deep maroon)
- Dark sections: #273f49 (dark teal)

### Fonts
- **Body**: Roboto
- **Headings**: Raleway
- **Navigation**: Libre Baskerville
- Also loaded: Poppins, Merriweather

### Frontend Libraries
- Bootstrap 5.3.3, Bootstrap Icons
- AOS (Animate On Scroll)
- GLightbox (image/video lightbox)
- Swiper 11.1.9 (carousel/slider)
- Isotope (grid filtering)
- ImagesLoaded (image load detection)
- PureCounter 1.5.0 (number animations)

## Interactive Features
- Mobile-responsive hamburger navigation
- Scroll-triggered animations (AOS)
- Image lightbox galleries (GLightbox)
- Swiper carousels
- Custom liturgical calendar (events-calendar.html, JS, hardcoded events 2024-2026)
- Background music player with toggle (index.html)
- Expandable parking/metro tabs (contact-us.html)
- PureCounter number animations

## Deployment
- **Production**: Push to `main` triggers `.github/workflows/deploy-main.yml` → FTP to GoDaddy `/new_website/root/`
- **Staging**: PR to `main` triggers `.github/workflows/deploy-staging.yml` → FTP to GoDaddy `/preprod.stbasilsboston.org/`
- Both use `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` GitHub Secrets
- Node.js build steps are commented out in both workflows (ready for future use)

## Known Issues

### Critical
1. **Contact form broken**: `forms/contact.php` uses placeholder email `contact@example.com`, and the required PHP Email Form library (`assets/vendor/php-email-form/php-email-form.php`) is not included
2. **JS null reference**: `assets/js/main.js` line 82 calls `scrollTop.addEventListener()` without null check — crashes if `.scroll-top` element is missing
3. **No HTML form exists**: `validate.js` is loaded on all 20 pages but no `<form class="php-email-form">` exists anywhere

### SEO
- Empty meta descriptions on `index.html` and `our-clergy.html`
- No Open Graph or Twitter Card tags on any page
- Duplicate `<title>` tags on sunday-school, stmarys-womens, stpauls-mensfellow, youth
- No canonical tags

### CSS
- 34 `!important` declarations in main.css
- Duplicate class definitions (`.image-container`, `.text-overlay`, `.service-item`)
- 70+ inline styles in `about.html`, heavy inline styling across other pages
- Non-standard inch-based CSS units mixed with pixels

### Accessibility
- Empty alt text on images in orphaned organization pages
- Missing ARIA labels on navigation elements
- Heading hierarchy issues (H2 before H1 on index)

### Other
- `newsletter.php` bug: `from_name` set to email address instead of subscriber name
- `our-clergy.html` re-initializes AOS with conflicting settings vs `main.js`
- Function typo: `mobileNavToogle` instead of `mobileNavToggle` in main.js
- Missing image: `assets/img/organizations/youth.jpg` (exists at `assets/img/Our Orgs/youth.jpg`)

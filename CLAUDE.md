# St. Basil's Syriac Orthodox Church Website - Project Context

## Overview
This is a static HTML website for St. Basil's Syriac Orthodox Church in Boston, Massachusetts. The website serves the Jacobite Malayalee community in the New England region (Maine, Rhode Island, New Hampshire, Connecticut).

## Technology Stack
- **Frontend**: Static HTML5, CSS3, JavaScript
- **CSS Framework**: Bootstrap 5.3.3
- **Template Base**: Squadfree Bootstrap Template
- **Backend**: PHP for contact forms
- **Hosting**: Windows/IIS (based on web.config)
- **Domain**: stbasilsboston.org

## Project Structure

### Root Directory
```
/
├── index.html              # Main landing page
├── about.html              # About the church page  
├── parking.html            # Parking information
├── spiritual-leader.html   # Spiritual leadership page
├── sunday-school.html      # Sunday school information
├── stmarys-womens.html     # St. Mary's Women's League
├── stpauls-mensfellow.html # St. Paul's Men's Fellowship
├── portfolio-details.html  # Portfolio details template
├── starter-page.html       # Starter template page
├── web.config             # IIS configuration
├── License.txt            # License information
└── Readme.txt            # Basic readme
```

### Key Directories

#### `/HTML/` - Legacy HTML Structure
Contains the older version of the website with:
- Individual HTML pages for different sections
- CSS files (Bootstrap, custom church.css, flexslider, fullcalendar)
- JavaScript libraries (jQuery, Bootstrap, FullCalendar, contact forms)
- Images directory with church photos, logos, and gallery
- PHP contact form handlers

#### `/assets/` - Current Website Assets
- **css/**: Main stylesheet (main.css)
- **img/**: Images including logos, backgrounds, organization photos, parking directions
- **js/**: Main JavaScript file (main.js)
- **vendor/**: Third-party libraries (Bootstrap, AOS, GLightbox, Swiper)

#### `/forms/` - Contact Form Handlers
- contact.php: Contact form processor
- newsletter.php: Newsletter subscription handler
- Both require PHP Email Form library (not included)

#### `/documentation/`
Template documentation with styling guide

#### `/PSD/`
Photoshop source files for design elements

## Navigation Structure

### Main Navigation
1. **Home** - Landing page with hero section
2. **Services** - Service times and information
3. **About** - Church history and information
4. **Our Organizations** (Dropdown)
   - Sunday School
   - St. Paul's Men's Fellowship
   - St. Mary's Women's League
   - Managing Committee
   - Spiritual Council
   - Spiritual Leaders
5. **Contact** - Contact information and form

## Key Features

### Service Times
- Morning Prayer: 8:30 AM EST (Sundays)
- Holy Qurbono: 9:15 AM EST (Sundays)

### Interactive Elements
- Mobile-responsive navigation with hamburger menu
- Dropdown menus for organization pages
- Image galleries with lightbox functionality
- Contact forms (requires PHP Email Form library)
- Smooth scrolling and animations (AOS library)
- Swiper carousel functionality

## Technical Details

### Frontend Libraries
- Bootstrap 5.3.3 - Responsive framework
- Bootstrap Icons - Icon library
- AOS (Animate On Scroll) - Scroll animations
- GLightbox - Image/video lightbox
- Swiper - Touch slider/carousel

### Fonts
- Roboto - Primary font
- Poppins - Secondary font
- Raleway - Additional font option

### IIS Configuration
The site is configured for Windows/IIS hosting with:
- Custom error pages defined in web.config
- Error documents stored in G:\PleskVhosts\stbasilsboston.org\error_docs\
- Compilation temp directory specified

## Important Notes

### Contact Form Configuration
- Contact forms currently use placeholder email (contact@example.com)
- Requires PHP Email Form library to be functional
- SMTP configuration is commented out and needs setup

### SEO Metadata
- Meta descriptions and keywords are present for SEO
- Author: George Nijo
- Robots: index,follow

### Responsive Design
- Fully responsive layout using Bootstrap grid
- Mobile navigation with toggle button
- Responsive images and content

## Development Considerations

### Current Issues/TODOs
1. Contact form email needs to be configured with actual church email
2. PHP Email Form library needs to be installed for forms to work
3. SMTP credentials need to be configured if using SMTP
4. Some navigation links may be broken (e.g., Managing Committee, Spiritual Council)

### Best Practices
- Use existing Bootstrap components and utilities
- Maintain consistent styling with main.css
- Follow mobile-first responsive design
- Keep JavaScript modular and organized
- Test on multiple browsers and devices

## Deployment
- Currently hosted on Windows/IIS server (Plesk environment)
- Uses web.config for server configuration
- Custom error pages configured for various HTTP status codes

## Version Control
- Git repository initialized
- Current branch: test-branch
- Main branch: main
- Recent commits show active development (Header changes, deployment workflow updates)
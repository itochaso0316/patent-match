# Template Usage Guide

This directory contains templated knowledge files designed to be reusable for ANY business. All files use Mustache `{{variable}}` syntax that can be filled in with your specific business data.

## Files in this Directory

| File | Type | Purpose | Template Variables |
|------|------|---------|-------------------|
| brand-identity.md | MD | Business brand essence and values | client, representative, metrics |
| site-inventory.yaml | YAML | Complete page/URL inventory | client, service, branch, page_count |
| seo-targets.yaml | YAML | SEO keywords and competitors | seo, competitor, client |
| structured-data.md | MD | Schema.org JSON-LD templates | client, schema_type, article |
| design-guide.md | MD | Visual design system rules | color, typography, breakpoint |
| design-guide-branch.md | MD | Sub-brand design customization | branch, branch_color, branch_tone |
| block-patterns.md | MD | WordPress component catalog | (universal - no variables) |
| component-rules.md | MD | Component usage guidelines | color, client |
| css-dictionary.md | MD | CSS utility class reference | (mostly universal) |
| image-management.md | MD | Image organization and guidelines | client, branch, brand_image_tone |

## How to Use These Templates

### Step 1: Create Your Configuration File

Create a `config.json` or `config.yaml` in your project with all template variables:

```yaml
# config.yaml
client:
  name: "Your Company Name"
  domain: "example.com"
  phone: "090-XXXX-XXXX"
  address:
    street: "1-1-1 Minato"
    city: "Tokyo"
    prefecture: "Tokyo"
    postal_code: "106-0032"
  description: "Your company description"
  slug: "your-company"

representative:
  name: "CEO Name"
  specialty: "Your Specialty"
  background: "Education and career history"
  core_message: "Your core business philosophy"
  values:
    - "Value 1"
    - "Value 2"
  phrases:
    - "Common phrase 1"
    - "Common phrase 2"
  stories:
    - "Founding story"
    - "Key achievement"

branch:
  name: "Branch Name"
  phone: "090-XXXX-XXXX"
  address:
    street: "2-2-2 Minato"
    city: "Tokyo"
    prefecture: "Tokyo"
    postal_code: "106-0032"
  slug: "branch-name"

color:
  primary: "#e74c3c"
  primary_light: "#f08080"
  primary_lighter: "#ffb3b3"
  text: "#333333"
  text_light: "#666666"
  white: "#ffffff"
  white_bis: "#f5f5f5"
  white_ter: "#f0f0f0"
  black: "#000000"

branch_color:
  primary: "#c4a5a5"
  primary_dark: "#a86a6a"
  primary_light: "#d8b8b8"
  primary_lighter: "#edd0d0"
  bg_white: "#fefcfc"
  bg_secondary1: "#faf0f0"
  bg_secondary2: "#fdf6f6"
  text: "#5a4a4c"
  text_light: "#8a7a7c"
  accent: "#c9a96e"

typography:
  body_font: "Noto Sans JP"
  body_size: "14px"
  body_line_height: "1.75"
  subtitle_font: "Playfair Display"
  title_font: "Noto Sans JP"
  icon_font: "icon-font-custom"

font_size:
  xsmall: "1.2rem"
  small: "1.3rem"
  normal: "1.4rem"
  medium: "1.6rem"
  large: "1.8rem"
  xlarge: "clamp(1.75rem, 3vw, 2.25rem)"

breakpoint:
  tablet: 768

layout:
  content_width: "1020px"
  content_width_wide: "clamp(1300px, 80vw, 100%)"

image:
  default_size: "large (1024x683)"

seo:
  tier1_kw1: "keyword 1 city"
  tier1_page1: "/service-1/"
  tier1_intent1: "User intent description"
  tier1_angle1: "Brand differentiation angle"
  tier1_kw2: "keyword 2 city"
  tier1_page2: "/service-2/"
  # ... more SEO keywords

competitor:
  domain1: "competitor1.com"
  name1: "Competitor 1"
  note1: "Competitive advantage note"
  area1: "City/Region"
  categories1: ["category1", "category2"]

metrics:
  name1: "Annual Customers"
  value1: "1,000+"
  period1: "2024"
  source1: "Internal Records"
  name2: "Services Offered"
  value2: "15+"
  period2: "Current"
  source2: "Service List"

brand_tone:
  element1: "Professional yet approachable"
  element2: "Trustworthy and reliable"
  element3: "Innovative and forward-thinking"

branch_tone: "Elegant, sophisticated, warm"
branch_image_tone: "Soft colors, approachable, premium feel"
```

### Step 2: Process Templates with Your Configuration

Use a templating tool to replace all `{{variable}}` occurrences:

**Option A: Using a Mustache Processor (Node.js)**
```javascript
const Mustache = require('mustache');
const fs = require('fs');
const yaml = require('js-yaml');

const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));
const brandIdentityTemplate = fs.readFileSync('brand-identity.md', 'utf8');

const output = Mustache.render(brandIdentityTemplate, config);
fs.writeFileSync('brand-identity-final.md', output);
```

**Option B: Using Jinja2 (Python)**
```python
from jinja2 import Template
import yaml

with open('config.yaml') as f:
    config = yaml.safe_load(f)

with open('brand-identity.md') as f:
    template = Template(f.read())

output = template.render(config)
with open('brand-identity-final.md', 'w') as f:
    f.write(output)
```

**Option C: Manual Find & Replace**
- Use VS Code Find & Replace (Ctrl+H)
- Search: `{{client.name}}`
- Replace with: `Your Company Name`
- Repeat for all variables

### Step 3: Update Your Knowledge Files

Replace the original templated files with the processed versions once verified:

```bash
# Backup originals
cp brand-identity.md brand-identity.template.md

# Use processed version
mv brand-identity-final.md brand-identity.md
```

### Step 4: Customize Beyond Template Variables

Some sections may need manual customization:

- **brand-identity.md**: Add real representative stories and philosophy
- **seo-targets.yaml**: Add actual competitor research data
- **design-guide.md**: Verify color codes match your brand guidelines
- **image-management.md**: Update Canva template IDs once created

## Example Variable Substitutions

### Before (Template)
```markdown
# {{client.name}} ブランドアイデンティティ

## 1. 代表者の人格・想い

### 基本情報
- 氏名: {{representative.name}}
- 専門: {{representative.specialty}}
```

### After (Filled)
```markdown
# Acme Corporation ブランドアイデンティティ

## 1. 代表者の人格・想い

### 基本情報
- 氏名: John Smith
- 専門: Business Strategy
```

## Template Variable Reference

### Client/Company Variables
- `{{client.name}}` - Company name
- `{{client.domain}}` - Website domain
- `{{client.phone}}` - Main phone number
- `{{client.slug}}` - URL-friendly company name
- `{{client.address.street}}` - Street address
- `{{client.address.city}}` - City
- `{{client.address.prefecture}}` - Region/State
- `{{client.address.postal_code}}` - Zip code

### Representative Variables
- `{{representative.name}}` - CEO/Owner name
- `{{representative.specialty}}` - Professional specialty
- `{{representative.background}}` - Education/career
- `{{representative.core_message}}` - Core philosophy
- `{{representative.values}}` - Array of core values
- `{{representative.phrases}}` - Array of key phrases

### Branch/Multi-location Variables
- `{{branch.name}}` - Branch/location name
- `{{branch.phone}}` - Branch phone
- `{{branch.address.*}}` - Branch address fields
- `{{branch.slug}}` - Branch URL slug
- `{{branch_tone}}` - Brand tone/personality
- `{{branch_color.*}}` - Branch-specific colors

### Design Variables
- `{{color.primary}}` - Primary brand color
- `{{color.primary_light}}` - Lighter variant
- `{{color.text}}` - Body text color
- `{{typography.body_font}}` - Main font family
- `{{breakpoint.tablet}}` - Mobile breakpoint (px)
- `{{layout.content_width}}` - Default content width

### SEO Variables
- `{{seo.tier1_kw1}}` - Tier 1 keyword
- `{{seo.tier1_page1}}` - Targeting page URL
- `{{seo.tier1_intent1}}` - User search intent
- `{{competitor.domain1}}` - Competitor domain

## Tips for Best Results

1. **Keep Data Consistent**: Update config once, templates use it everywhere
2. **Use Defaults**: If a branch doesn't have custom colors, inherit from parent
3. **Iterate Safely**: Keep template originals (`*.template.md`) as backup
4. **Test Links**: After substitution, verify all URLs are absolute paths
5. **SEO Check**: Ensure keywords match actual target pages
6. **Brand Compliance**: Double-check colors and tone match brand guidelines

## Troubleshooting

**Q: Template variable not replaced?**
- Check spelling (case-sensitive): `{{client.name}}` ≠ `{{Client.Name}}`
- Verify config file has the variable
- Check processor is using correct syntax (Mustache vs Jinja2)

**Q: Nested objects not working?**
- Use dot notation: `{{client.address.city}}`
- Verify config structure matches template

**Q: Arrays not iterating?**
- Use `{{#array}}` ... `{{/array}}` for Mustache
- Or `{% for item in array %}` for Jinja2

**Q: Need to update multiple branches?**
- Create branch-specific configs
- Process each template separately with branch config

## Support

For issues or questions about templates:
1. Check the original Misao template files for examples
2. Review the config.yaml template above
3. Test with a single file first before batch processing

import type { ProductCardData } from '../types/product.types';
import { getProductSlug } from '../utils/product.utils';

// Flagship Cady Trousers Reference Product (from Reference Screenshots)
export const cadyTrousersProduct: ProductCardData = {
  id: "cady-trousers",
  slug: "cady-trousers",
  title: "Cady trousers",
  price: "€ 750.00",
  priceNum: 75000,
  badge: "NEW IN",
  tag: "JOGGING",
  defaultImg: "/images/cady-trousers-model.jpg",
  hoverImg: "/images/cady-trousers-product.jpg",
  images: [
    "/images/cady-trousers-product.jpg",
    "/images/cady-trousers-model.jpg",
    "/images/cady-trousers-model-3.jpg",
    "/images/cady-trousers-model-4.jpg",
    "/images/cady-trousers-detail.jpg"
  ],
  sizes: ["IT 38", "IT 40", "IT 42", "IT 44", "IT 46", "IT 48"],
  link: "/products/cady-trousers",
  sku: "PAD216F336M28900000145",
  category: "Trousers",
  gender: "Women",
  description:
    "Wide leg trousers in cady with an elasticated waist for refined comfort. Filo diamante adds a luminous and discreet accent, enhancing the design with natural sophistication. Made in India through sustainable processes.",
  colors: [
    {
      name: "Butter",
      hex: "#F9F5EC",
      swatchImg: "/images/cady-trousers-swatch.jpg",
      img: "/images/cady-trousers-product.jpg",
      images: [
        "/images/cady-trousers-product.jpg",
        "/images/cady-trousers-model.jpg",
        "/images/cady-trousers-model-3.jpg",
        "/images/cady-trousers-model-4.jpg",
        "/images/cady-trousers-detail.jpg"
      ]
    },
    {
      name: "Nero Assoluto",
      hex: "#1A1A1A",
      img: "/images/cady-trousers-product.jpg"
    },
    {
      name: "Sartorial Camel",
      hex: "#BF9B7B",
      img: "/images/cady-trousers-product.jpg"
    }
  ],
  sizeAndFit: [
    "Model is 178 cm / 5'10\" and is wearing size 40.",
    "Wide leg cut with tailored pressed creases along the front and back.",
    "Mid-rise fit with an elasticated gathered waistband for maximum refinement and ease.",
    "Inside leg length: 84 cm / 33.1 inches.",
    "Leg opening hem circumference: 56 cm / 22 inches."
  ],
  compositionAndCare: [
    "Main fabric: 71% Triacetate, 29% Polyethylene Cady. Made in India.",
    "Filo diamante micro-thread luminous detailing.",
    "Pocket lining: 100% Cupro with jacquard weave.",
    "Dry clean only in tetrachloroethene or hydrocarbons, mild treatment.",
    "Do not wash with water. Do not bleach. Do not tumble dry.",
    "Iron at maximum sole plate temperature of 110°C / 230°F without steam."
  ],
  shippingAndReturns: [
    "Complimentary express worldwide courier delivery on all orders.",
    "Presented in DEYNOLD DANNY archival keepsake packaging with cedar hanger.",
    "Complimentary 14-day returns and exchanges handled door-to-door."
  ],
  styleItWith: [
    {
      id: "cady-vest",
      title: "Cady vest",
      price: "€ 580.00",
      priceNum: 58000,
      image: "/images/cady-vest.jpg",
      link: "#cady-vest"
    },
    {
      id: "nappa-leather-flat",
      title: "Nappa leather flat",
      price: "€ 720.00",
      priceNum: 72000,
      image: "/images/nappa-flat.jpg",
      link: "#nappa-leather-flat"
    }
  ],
  relatedProducts: [
    {
      id: "suggest-1",
      title: "Jacquard jogging pants in lurex-linen blend",
      price: "€ 850.00",
      priceNum: 85000,
      image: "/images/suggest-pants-1.jpg",
      link: "#"
    },
    {
      id: "suggest-2",
      title: "Regular fit houndstooth trousers",
      price: "€ 970.00",
      priceNum: 97000,
      image: "/images/suggest-pants-2.jpg",
      link: "#"
    },
    {
      id: "suggest-3",
      title: "Flared trousers in mohair-wool blend satin",
      price: "€ 910.00",
      priceNum: 91000,
      image: "/images/suggest-pants-3.jpg",
      link: "#"
    },
    {
      id: "suggest-4",
      title: "Satin jogging trousers in Milano stitch jersey",
      price: "€ 760.00",
      priceNum: 76000,
      image: "/images/suggest-pants-4.jpg",
      link: "#"
    }
  ]
};

// Flagship Bordeaux Sheath Dress Reference Product (from Rinascimento Reference Screenshots)
export const bordeauxSheathDressProduct: ProductCardData = {
  id: "bordeaux-sheath-dress-with-asymmetrical-draping",
  slug: "bordeaux-sheath-dress-with-asymmetrical-draping",
  title: "Bordeaux sheath dress with asymmetrical draping",
  price: "€ 189.00",
  priceNum: 18900,
  badge: "SOLD OUT",
  tag: "SHEATH DRESS",
  defaultImg: "/images/bordeaux-dress-model.jpg",
  hoverImg: "/images/bordeaux-dress-detail.jpg",
  images: [
    "/images/bordeaux-dress-back.jpg",
    "/images/bordeaux-dress-detail.jpg",
    "/images/bordeaux-dress-model.jpg",
    "/images/bordeaux-dress-side.jpg"
  ],
  sizes: ["IT 38", "IT 40", "IT 42", "IT 44", "IT 46"],
  link: "/products/bordeaux-sheath-dress-with-asymmetrical-draping",
  sku: "CFC0130327003B098",
  category: "Clothing",
  subCategory: "Short Dresses",
  gender: "Women",
  description:
    "Feminine sheath dress crafted in stretch cady with asymmetrical side draping that contours the silhouette with timeless grace. Round neckline, three-quarter sleeves, and invisible rear zip fastening. Made in India through sustainable artisanal processes.",
  colors: [
    {
      name: "Bordeaux",
      hex: "#6b2144",
      swatchImg: "/images/bordeaux-dress-detail.jpg",
      img: "/images/bordeaux-dress-model.jpg",
      images: [
        "/images/bordeaux-dress-back.jpg",
        "/images/bordeaux-dress-detail.jpg",
        "/images/bordeaux-dress-model.jpg",
        "/images/bordeaux-dress-side.jpg"
      ]
    },
    {
      name: "Dark Slate",
      hex: "#2b363d",
      img: "/images/bordeaux-dress-model.jpg"
    },
    {
      name: "Coral Red",
      hex: "#f43f4f",
      img: "/images/bordeaux-dress-model.jpg"
    },
    {
      name: "Espresso",
      hex: "#3a282b",
      img: "/images/bordeaux-dress-model.jpg"
    }
  ],
  sizeAndFit: [
    "Model is 177 cm / 5'9.5\" and is wearing size 40.",
    "Form-fitting sheath silhouette with asymmetrical pleated gathering at the waist.",
    "Knee length hemline with center-back walking vent.",
    "Sleeve length: 48 cm."
  ],
  compositionAndCare: [
    "Composition: 96% Polyester, 4% Elastane.",
    "Lining: 100% Stretch cupro.",
    "Care: Dry clean only. Iron at low temperature.",
    "Carefully crafted in India."
  ],
  shippingAndReturns: [
    "Complimentary express delivery across India and worldwide.",
    "Returns accepted within 14 days of receipt."
  ]
};

export const masteryProducts: ProductCardData[] = [
  bordeauxSheathDressProduct,
  {
    id: "mastery-1",
    slug: "artisanal-ribbed-cashmere-zip-sweater",
    title: "Artisanal ribbed cashmere zip sweater",
    price: "₹ 72,500.00",
    priceNum: 72500,
    badge: "NEW IN",
    tag: "100% CASHMERE",
    defaultImg: "/images/mastery-men-1.jpg",
    hoverImg: "/images/mastery-men-1-hover.jpg",
    images: [
      "/images/mastery-men-1-hover.jpg",
      "/images/mastery-men-1.jpg"
    ],
    sizes: ["44", "46", "48", "50", "52"],
    link: "/products/artisanal-ribbed-cashmere-zip-sweater",
    sku: "SWT552M108K9000000412",
    category: "Knitwear",
    gender: "Men",
    description:
      "Spun from ultra-fine Mongolian inner fleece cashmere. Made in India with artisanal craftsmanship. Features a half-zip mock collar, English rib knit construction, and hand-stitched calfskin zip puller.",
    colors: [
      { name: "Natural Oatmeal", hex: "#E8E2D7", img: "/images/mastery-men-1.jpg" },
      { name: "Slate Blue", hex: "#4E6D82" },
      { name: "Midnight Navy", hex: "#1C2434" }
    ],
    sizeAndFit: [
      "Model is 187 cm / 6'1\" and wears size 48.",
      "Regular sartorial fit designed for layered or standalone elegance.",
      "Ribbed collar, cuffs, and hem retain elasticity and form."
    ],
    compositionAndCare: [
      "100% Mongolian Cashmere (2-ply 12-gauge yarn).",
      "Hand-burnished calfskin leather zip pull.",
      "Hand wash cold with wool detergent or dry clean gently.",
      "Dry flat away from direct heat."
    ],
    shippingAndReturns: [
      "Complimentary express courier shipping worldwide.",
      "Signature archival packaging and breathable garment protector included.",
      "Complimentary 14-day returns."
    ]
  },
  {
    id: "mastery-2",
    slug: "tailored-virgin-wool-overcoat-with-cashmere-scarf",
    title: "Tailored virgin wool overcoat with cashmere scarf",
    price: "₹ 165,000.00",
    priceNum: 165000,
    badge: "NEW IN",
    tag: "DOUBLE CLOTH",
    defaultImg: "/images/mastery-men-2.jpg",
    hoverImg: "/images/mastery-men-2-hover.jpg",
    images: [
      "/images/mastery-men-2-hover.jpg",
      "/images/mastery-men-2.jpg"
    ],
    sizes: ["46", "48", "50", "52", "54"],
    link: "/products/tailored-virgin-wool-overcoat-with-cashmere-scarf",
    sku: "COT710F821W1900000078",
    category: "Overcoats",
    gender: "Men",
    description:
      "Hand-sewn double-splittable virgin wool and cashmere double cloth overcoat. Unstructured shoulder drape with horn button closure and an integrated fine cashmere scarf accent.",
    colors: [
      { name: "Vicuna Camel", hex: "#9D744A", img: "/images/mastery-men-2.jpg" },
      { name: "Charcoal Melange", hex: "#3A3A3C" }
    ],
    sizeAndFit: [
      "Model is 188 cm / 6'2\" and wears size 50.",
      "Tailored overcoat cut designed to layer over tailoring or fine knitwear."
    ],
    compositionAndCare: [
      "90% Virgin Wool, 10% Cashmere.",
      "Genuine buffalo horn buttons with engraved crest.",
      "Specialist dry clean only."
    ],
    shippingAndReturns: [
      "Complimentary courier delivery worldwide.",
      "Includes bespoke hanger and garment bag."
    ]
  },
  {
    id: "mastery-3",
    slug: "sartorial-poplin-and-twill-dress-shirts-trio",
    title: "Sartorial poplin and twill dress shirts trio",
    price: "₹ 42,000.00",
    priceNum: 42000,
    badge: "NEW IN",
    tag: "GIZA COTTON",
    defaultImg: "/images/mastery-men-3.jpg",
    hoverImg: "/images/mastery-men-3-hover.jpg",
    images: [
      "/images/mastery-men-3-hover.jpg",
      "/images/mastery-men-3.jpg"
    ],
    sizes: ["38", "39", "40", "41", "42", "43"],
    link: "/products/sartorial-poplin-and-twill-dress-shirts-trio",
    sku: "SHR204C115G8800000104",
    category: "Shirts",
    gender: "Men",
    description:
      "Woven from Egyptian Giza 87 long-staple cotton yarn. Tailored with single-needle stitching, Australian mother-of-pearl buttons, and removable brass collar stays.",
    colors: [
      { name: "Crisp Bianco", hex: "#FAFAFA", img: "/images/mastery-men-3.jpg" },
      { name: "Sky Blue Bengal", hex: "#C5D8E8" }
    ],
    sizeAndFit: [
      "Model is 185 cm with a 39 cm neck and wears size 40.",
      "Contemporary slim-fit with natural waist taper."
    ],
    compositionAndCare: [
      "100% Giza 87 Long-Staple Cotton.",
      "Machine wash 30°C delicate."
    ],
    shippingAndReturns: [
      "Complimentary worldwide express shipping.",
      "Includes 3-pack signature presentation box."
    ]
  },
  {
    id: "mastery-4",
    slug: "hand-burnished-artisanal-calfskin-oxford-shoes",
    title: "Hand-burnished artisanal calfskin oxford shoes",
    price: "₹ 58,000.00",
    priceNum: 58000,
    badge: "NEW IN",
    tag: "GOODYEAR WELT",
    defaultImg: "/images/mastery-men-4.jpg",
    hoverImg: "/images/mastery-men-4-hover.jpg",
    images: [
      "/images/mastery-men-4-hover.jpg",
      "/images/mastery-men-4.jpg"
    ],
    sizes: ["40", "41", "42", "43", "44", "45"],
    link: "/products/hand-burnished-artisanal-calfskin-oxford-shoes",
    sku: "SHOE881C300L220000054",
    category: "Footwear",
    gender: "Men",
    description:
      "Handmade in India using premium full-grain French calfskin. Hand-patinated with natural waxes and constructed on a classic Goodyear welted channeled leather sole.",
    colors: [
      { name: "Castagno Brown", hex: "#4A2E1B", img: "/images/mastery-men-4.jpg" },
      { name: "Nero Assoluto", hex: "#1C1C1C" }
    ],
    sizeAndFit: [
      "True to European sizing with standard EE width.",
      "Sculpted arch support with cushioned cork insole."
    ],
    compositionAndCare: [
      "Upper: 100% Full-Grain French Calfskin.",
      "Lining: Vegetable-tanned calf leather.",
      "Sole: Channeled oak-bark tanned leather sole."
    ],
    shippingAndReturns: [
      "Express shipping with complimentary doorstep delivery.",
      "Includes flannel dustbags and cedar shoe trees."
    ]
  },
  {
    id: "mastery-5",
    slug: "fringed-cashmere-artisanal-scarf",
    title: "Fringed cashmere artisanal scarf",
    price: "₹ 32,500.00",
    priceNum: 32500,
    badge: "NEW IN",
    tag: "HAND-LOOMED",
    defaultImg: "/images/mastery-men-5.jpg",
    hoverImg: "/images/mastery-men-5-hover.jpg",
    images: [
      "/images/mastery-men-5-hover.jpg",
      "/images/mastery-men-5.jpg"
    ],
    sizes: ["UNI"],
    link: "/products/fringed-cashmere-artisanal-scarf",
    sku: "ACC440K099C710000091",
    category: "Accessories",
    gender: "Unisex",
    description:
      "Artisanal hand-loomed cashmere scarf woven on heritage shuttle looms in Umbria. Features delicate selvedge edges and hand-twisted feather fringes.",
    colors: [
      { name: "Ecru Melange", hex: "#D6CFBE", img: "/images/mastery-men-5.jpg" },
      { name: "Camel", hex: "#A67B4F" }
    ],
    sizeAndFit: [
      "One Size: 200 cm x 50 cm / 78.7 x 19.7 inches."
    ],
    compositionAndCare: [
      "100% Fine Grade Mongolian Cashmere.",
      "Dry clean only."
    ],
    shippingAndReturns: [
      "Complimentary shipping worldwide.",
      "14-day return privilege."
    ]
  }
];

export const styleSpaceProducts: ProductCardData[] = [
  {
    id: "style-1",
    slug: "sartorial-washed-linen-button-down-shirt",
    title: "Sartorial washed linen button-down shirt",
    price: "₹ 28,500.00",
    priceNum: 28500,
    badge: "NEW IN",
    tag: "NORMANDY LINEN",
    defaultImg: "/images/style-space-1.jpg",
    hoverImg: "/images/style-space-1-hover.jpg",
    images: [
      "/images/style-space-1-hover.jpg",
      "/images/style-space-1.jpg"
    ],
    sizes: ["39", "40", "41", "42", "43"],
    link: "/products/sartorial-washed-linen-button-down-shirt",
    sku: "SHR311L400W100000019",
    category: "Shirts",
    gender: "Men",
    description:
      "Spun from certified European flax harvested in Normandy. Garment-washed using aloe enzymes for an exceptionally soft hand-feel that drapes with relaxed Mediterranean poise.",
    colors: [
      { name: "Chalk White", hex: "#F5F3EF", img: "/images/style-space-1.jpg" }
    ],
    sizeAndFit: [
      "Model is 186 cm / 6'1\" and wears size 40."
    ],
    compositionAndCare: [
      "100% Normandy Pure Linen.",
      "Natural river shell buttons."
    ],
    shippingAndReturns: [
      "Complimentary express worldwide shipping."
    ]
  },
  {
    id: "style-2",
    slug: "stand-collar-virgin-wool-tailored-car-coat",
    title: "Stand-collar virgin wool tailored car coat",
    price: "₹ 125,000.00",
    priceNum: 125000,
    badge: "NEW IN",
    tag: "WATER-REPELLENT",
    defaultImg: "/images/style-space-2.jpg",
    hoverImg: "/images/style-space-2-hover.jpg",
    images: [
      "/images/style-space-2-hover.jpg",
      "/images/style-space-2.jpg"
    ],
    sizes: ["46", "48", "50", "52", "54"],
    link: "/products/stand-collar-virgin-wool-tailored-car-coat",
    sku: "COT602W990A330000082",
    category: "Overcoats",
    gender: "Men",
    description:
      "A modern minimalist car coat cut from dense virgin wool treated with an invisible hydrophobic membrane. Structured stand collar and concealed two-way zipper.",
    colors: [
      { name: "Anthracite", hex: "#2B2E33", img: "/images/style-space-2.jpg" }
    ],
    sizeAndFit: [
      "Model is 189 cm / 6'2\" and wears size 50."
    ],
    compositionAndCare: [
      "100% Fine Virgin Wool with Storm-Proof treatment."
    ],
    shippingAndReturns: [
      "Complimentary express shipping and returns."
    ]
  },
  {
    id: "style-3",
    slug: "ribbed-cashmere-crewneck-knit-sweater",
    title: "Ribbed cashmere crewneck knit sweater",
    price: "₹ 48,000.00",
    priceNum: 48000,
    badge: "NEW IN",
    tag: "SEAMLESS KNIT",
    defaultImg: "/images/style-space-3.jpg",
    hoverImg: "/images/style-space-3-hover.jpg",
    images: [
      "/images/style-space-3-hover.jpg",
      "/images/style-space-3.jpg"
    ],
    sizes: ["44", "46", "48", "50", "52"],
    link: "/products/ribbed-cashmere-crewneck-knit-sweater",
    sku: "SWT420K100M600000021",
    category: "Knitwear",
    gender: "Men",
    description:
      "Crafted with WholeGarment 3D knitting technology for a seamless, ergonomic drape. 7-gauge pure cashmere ribbing offers cloud-like thermal warmth.",
    colors: [
      { name: "Taupe Melange", hex: "#8A7E72", img: "/images/style-space-3.jpg" }
    ],
    sizeAndFit: [
      "Model is 185 cm / 6'1\" and wears size 48."
    ],
    compositionAndCare: [
      "100% Pure Cashmere. Made in India."
    ],
    shippingAndReturns: [
      "Complimentary express delivery worldwide."
    ]
  },
  {
    id: "style-4",
    slug: "handcrafted-burnished-calfskin-ankle-boots",
    title: "Handcrafted burnished calfskin ankle boots",
    price: "₹ 54,000.00",
    priceNum: 54000,
    badge: "NEW IN",
    tag: "VIBRAM SOLE",
    defaultImg: "/images/style-space-4.jpg",
    hoverImg: "/images/style-space-4-hover.jpg",
    images: [
      "/images/style-space-4-hover.jpg",
      "/images/style-space-4.jpg"
    ],
    sizes: ["40", "41", "42", "43", "44"],
    link: "/products/handcrafted-burnished-calfskin-ankle-boots",
    sku: "BOT912L880E550000037",
    category: "Footwear",
    gender: "Men",
    description:
      "Ankle boots sculpted from supple vegetable-tanned Tuscan calfskin. Finished with elastic side gussets, woven pull tabs, and lightweight storm welt Vibram rubber soles.",
    colors: [
      { name: "Espresso", hex: "#32221A", img: "/images/style-space-4.jpg" }
    ],
    sizeAndFit: [
      "Standard European sizing. Fits true to size."
    ],
    compositionAndCare: [
      "100% Tuscan Calfskin Leather."
    ],
    shippingAndReturns: [
      "Complimentary courier delivery."
    ]
  },
  {
    id: "style-5",
    slug: "round-polarized-sunglasses-on-carrara-marble",
    title: "Round polarized sunglasses on Carrara marble",
    price: "₹ 24,500.00",
    priceNum: 24500,
    badge: "NEW IN",
    tag: "MAZZUCCHELLI ACETATE",
    defaultImg: "/images/style-space-5.jpg",
    hoverImg: "/images/style-space-5-hover.jpg",
    images: [
      "/images/style-space-5-hover.jpg",
      "/images/style-space-5.jpg"
    ],
    sizes: ["UNI"],
    link: "/products/round-polarized-sunglasses-on-carrara-marble",
    sku: "EYE109A200H120000083",
    category: "Accessories",
    gender: "Unisex",
    description:
      "Hand-polished Japanese titanium and bio-acetate frames. Fitted with polarized Zeiss mineral glass lenses offering 100% UVA/UVB protection.",
    colors: [
      { name: "Havana Amber", hex: "#754C24", img: "/images/style-space-5.jpg" }
    ],
    sizeAndFit: [
      "Bridge: 21mm, Lens Width: 49mm, Temple Length: 145mm."
    ],
    compositionAndCare: [
      "Handcrafted Cellulose Acetate and Pure Titanium."
    ],
    shippingAndReturns: [
      "Complimentary worldwide delivery."
    ]
  }
];

export const newsProducts: ProductCardData[] = [
  {
    id: "news-1",
    slug: "suede-and-calfskin-zip-biker-jacket",
    title: "Suede and calfskin zip biker jacket",
    price: "₹ 185,000.00",
    priceNum: 185000,
    badge: "NEW IN",
    tag: "HAND-BUFFED SUEDE",
    defaultImg: "/images/news-men-1.jpg",
    hoverImg: "/images/news-men-1-hover.jpg",
    images: [
      "/images/news-men-1-hover.jpg",
      "/images/news-men-1.jpg"
    ],
    sizes: ["46", "48", "50", "52", "54"],
    link: "/products/suede-and-calfskin-zip-biker-jacket",
    sku: "JKT701S400C990000015",
    category: "Outerwear",
    gender: "Men",
    description:
      "Velvety goat suede tanned with natural tannins. Made in India. Features two-way brushed palladium zippers, silk-cupro lining, and snap cuffs.",
    colors: [
      { name: "Cognac Amber", hex: "#8A4F2A", img: "/images/news-men-1.jpg" }
    ],
    sizeAndFit: [
      "Model is 187 cm / 6'1\" and wears size 48."
    ],
    compositionAndCare: [
      "100% Premium Kid Suede. Made in India."
    ],
    shippingAndReturns: [
      "Complimentary white-glove delivery worldwide."
    ]
  },
  {
    id: "news-2",
    slug: "minimalist-cotton-twill-tailored-trench-coat",
    title: "Minimalist cotton-twill tailored trench coat",
    price: "₹ 125,000.00",
    priceNum: 125000,
    badge: "NEW IN",
    tag: "GABARDINE",
    defaultImg: "/images/news-men-2.jpg",
    hoverImg: "/images/news-men-2-hover.jpg",
    images: [
      "/images/news-men-2-hover.jpg",
      "/images/news-men-2.jpg"
    ],
    sizes: ["46", "48", "50", "52", "54"],
    link: "/products/minimalist-cotton-twill-tailored-trench-coat",
    sku: "COT555C100K440000067",
    category: "Overcoats",
    gender: "Men",
    description:
      "Heavyweight weatherproof cotton gabardine weave with unlined back storm flap, raglan shoulders, and belted waist.",
    colors: [
      { name: "Stone Khaki", hex: "#9B9483", img: "/images/news-men-2.jpg" }
    ],
    sizeAndFit: [
      "Model is 188 cm and wears size 50."
    ],
    compositionAndCare: [
      "100% Water-Resistant Cotton Gabardine."
    ],
    shippingAndReturns: [
      "Complimentary express shipping."
    ]
  },
  {
    id: "news-3",
    slug: "deconstructed-tailored-wool-silk-evening-blazer",
    title: "Deconstructed tailored wool-silk evening blazer",
    price: "₹ 145,000.00",
    priceNum: 145000,
    badge: "NEW IN",
    tag: "SARTORIAL",
    defaultImg: "/images/news-men-3.jpg",
    hoverImg: "/images/news-men-3-hover.jpg",
    images: [
      "/images/news-men-3-hover.jpg",
      "/images/news-men-3.jpg"
    ],
    sizes: ["46", "48", "50", "52", "54"],
    link: "/products/deconstructed-tailored-wool-silk-evening-blazer",
    sku: "BLZ890W200S110000049",
    category: "Tailoring",
    gender: "Men",
    description:
      "Spun from a decadent blend of Super 150s virgin wool and mulberry silk. Made in India with soft natural shoulder construction and mother-of-pearl buttons.",
    colors: [
      { name: "Midnight Blue", hex: "#162035", img: "/images/news-men-3.jpg" }
    ],
    sizeAndFit: [
      "Model is 186 cm and wears size 48."
    ],
    compositionAndCare: [
      "85% Super 150s Wool, 15% Mulberry Silk."
    ],
    shippingAndReturns: [
      "Complimentary courier delivery."
    ]
  },
  {
    id: "news-4",
    slug: "handcrafted-tuscan-leather-travel-weekender",
    title: "Handcrafted Tuscan leather travel weekender",
    price: "₹ 98,000.00",
    priceNum: 98000,
    badge: "NEW IN",
    tag: "FULL-GRAIN LEATHER",
    defaultImg: "/images/news-men-4.jpg",
    hoverImg: "/images/news-men-4-hover.jpg",
    images: [
      "/images/news-men-4-hover.jpg",
      "/images/news-men-4.jpg"
    ],
    sizes: ["UNI"],
    link: "/products/handcrafted-tuscan-leather-travel-weekender",
    sku: "BAG302L900T660000028",
    category: "Accessories",
    gender: "Unisex",
    description:
      "Masterfully assembled from thick vegetable-tanned Tuscan saddle leather. Solid brass hardware, reinforced rolled handles, and detachable canvas shoulder strap.",
    colors: [
      { name: "Saddle Tan", hex: "#8F5027", img: "/images/news-men-4.jpg" }
    ],
    sizeAndFit: [
      "Dimensions: 52 cm x 30 cm x 26 cm."
    ],
    compositionAndCare: [
      "100% Full Grain Tuscan Vacchetta Leather."
    ],
    shippingAndReturns: [
      "Complimentary shipping with archival dustbag."
    ]
  },
  {
    id: "news-5",
    slug: "automatic-chronograph-timepiece-with-alligator-strap",
    title: "Automatic chronograph timepiece with alligator strap",
    price: "₹ 340,000.00",
    priceNum: 340000,
    badge: "NEW IN",
    tag: "SWISS MOVEMENT",
    defaultImg: "/images/news-men-5.jpg",
    hoverImg: "/images/news-men-5-hover.jpg",
    images: [
      "/images/news-men-5-hover.jpg",
      "/images/news-men-5.jpg"
    ],
    sizes: ["UNI"],
    link: "/products/automatic-chronograph-timepiece-with-alligator-strap",
    sku: "WCH999M100S770000001",
    category: "Timepieces",
    gender: "Unisex",
    description:
      "Swiss-made COSC certified automatic chronometer movement with 68-hour power reserve. Housed in a hand-polished 40mm 316L stainless steel case with Louisiana alligator strap.",
    colors: [
      { name: "Sunburst Silver", hex: "#D8D8D8", img: "/images/news-men-5.jpg" }
    ],
    sizeAndFit: [
      "Case diameter: 40mm, thickness: 11.2mm, lug width: 20mm."
    ],
    compositionAndCare: [
      "316L Stainless steel, sapphire crystal, Louisiana alligator strap."
    ],
    shippingAndReturns: [
      "Secured insured white-glove transport with 5-year international warranty."
    ]
  }
];

export const allProducts: ProductCardData[] = [
  bordeauxSheathDressProduct,
  cadyTrousersProduct,
  ...masteryProducts,
  ...styleSpaceProducts,
  ...newsProducts
];

export function getProductBySlug(slug: string): ProductCardData | undefined {
  return allProducts.find(p => getProductSlug(p) === slug || p.id === slug);
}

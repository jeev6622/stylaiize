/**
 * Mock AI provider.
 * Used when no real AI provider is configured (demo mode). Produces
 * deterministic, well-structured demo output so the entire product remains
 * explorable without any external API keys.
 */
import { extractJson } from "./http";
import type { AIProviderPort, AIRequest, AIResponse } from "./provider.interface";

const EVENT_KEYWORDS: Array<{ category: string; terms: string[]; label: string }> = [
  { category: "wedding", terms: ["wedding", "shaadi", "marriage"], label: "Wedding" },
  { category: "job_interview", terms: ["interview", "job"], label: "Job Interview" },
  { category: "office_meeting", terms: ["meeting", "office", "work", "conference call"], label: "Office Meeting" },
  { category: "birthday_party", terms: ["birthday", "bday"], label: "Birthday Party" },
  { category: "college_farewell", terms: ["farewell", "college", "convocation"], label: "College Farewell" },
  { category: "date_night", terms: ["date", "dinner"], label: "Date Night" },
  { category: "festival", terms: ["festival", "diwali", "holi", "eid", "pongal"], label: "Festival" },
  { category: "beach_trip", terms: ["beach", "vacation", "holiday", "trip", "resort"], label: "Beach Trip" },
  { category: "business_conference", terms: ["conference", "summit", "seminar"], label: "Business Conference" },
  { category: "gym", terms: ["gym", "workout", "fitness"], label: "Gym" },
  { category: "travel", terms: ["travel", "flight", "journey"], label: "Travel" },
  { category: "casual_outing", terms: ["outing", "casual", "mall", "coffee"], label: "Casual Outing" },
];

function detectEventFromText(text: string): Record<string, unknown> {
  const lower = text.toLowerCase();
  const hit = EVENT_KEYWORDS.find((k) => k.terms.some((t) => lower.includes(t)));
  return {
    name: hit?.label ?? "Special Event",
    category: hit?.category ?? "other",
    date: null,
    time: null,
    venue: null,
    dressCode: null,
    theme: null,
    indoorOutdoor: "unknown",
    source: "manual",
  };
}

function outfitSet(index: number): Record<string, unknown> {
  const base = [
    {
      name: "The Timeless Classic",
      category: "smart_casual",
      explanation:
        "A navy blazer over a crisp white shirt with tailored chinos. Versatile, flattering on most builds, and easy to dress up or down.",
    },
    {
      name: "The Confidence Sharp",
      category: "formal",
      explanation:
        "A charcoal suit with a light-blue shirt and a subtle pocket square. Polished and professional while keeping you comfortable.",
    },
    {
      name: "The Effortless Minimal",
      category: "casual",
      explanation:
        "A premium knit polo with slim dark jeans and clean white sneakers. Low effort, high style, works all day.",
    },
    {
      name: "The Statement Layer",
      category: "smart_casual",
      explanation:
        "A textured crewneck sweater over a collared shirt with tapered trousers. Adds depth and dimension for cooler settings.",
    },
    {
      name: "The Modern Monochrome",
      category: "smart_casual",
      explanation:
        "Head-to-toe tonal dressing in earthy neutrals. Looks expensive, photographs well, and flatters your palette.",
    },
  ][index];

  const items = [
    { type: "shirt", name: base?.name === "The Timeless Classic" ? "White Oxford Shirt" : "Light-Blue Poplin Shirt", color: "#f8fafc", price: 1299 },
    { type: "trousers", name: "Tailored Trousers", color: "#334155", price: 1899 },
    { type: "shoes", name: "Brown Leather Loafers", color: "#7c4a1e", price: 2499 },
    { type: "watch", name: "Minimal Chronograph Watch", color: "#1e293b", price: 3299 },
    { type: "belt", name: "Full-Grain Leather Belt", color: "#6b4226", price: 799 },
    { type: "accessory", name: "Slim Wallet & Pocket Square", color: "#0f172a", price: 599 },
    { type: "perfume", name: "Woody Fresh Eau de Parfum", color: null, price: 1899 },
  ];

  return {
    id: `outfit-demo-${index + 1}`,
    name: base?.name ?? "Styled Look",
    category: base?.category ?? "smart_casual",
    explanation: base?.explanation ?? "Chosen to balance style, comfort, and budget.",
    items: items.map((it, i) => ({
      type: it.type,
      name: it.name,
      brand: null,
      color: it.color,
      price: it.price,
      currency: "INR",
      buyUrl: null,
      imageUrl: null,
      reason: `Recommended ${it.name.toLowerCase()} because it pairs cleanly with the rest of the look (item ${i + 1}).`,
    })),
    scores: {
      fashion: 88 - index * 4,
      eventMatch: 92 - index * 3,
      comfort: 85 - index * 2,
      budget: 90 - index * 3,
    },
    totalCost: 15193,
    tryOnUrl: null,
    createdAt: new Date().toISOString(),
  };
}

const TASK_RESPONSES: Record<string, (req: AIRequest) => Record<string, unknown> | string> = {
  detect_event: (req) => {
    const text = req.messages.map((m) => m.content).join("\n");
    return { ...detectEventFromText(text), source: req.images?.length ? "invitation_image" : "manual" };
  },

  analyze_photo: () => ({
    name: "Tailored Cotton Shirt",
    category: "tops",
    color: "White",
    brand: null,
    tags: ["shirt", "cotton", "tailored"],
    confidence: 86,
  }),

  analyze_body: () => ({
    faceShape: "oval",
    skinTone: "medium-tan",
    undertone: "warm",
    bodyProportion: "balanced",
    hair: { length: "short", type: "straight", color: "black" },
    beard: { style: "light stubble", density: "moderate" },
    heightEstimateCm: 175,
    fashionStyle: "classic with modern touches",
    seasonalPalette: "Autumn (warm, earthy tones)",
  }),

  analyze_style_profile: () => ({
    faceShape: "oval",
    hairType: "wavy",
    hairLength: "short",
    undertone: "warm",
    bodyBuild: "average",
    paletteSuggestions: [
      "Demo sample palette (not a real analysis)",
      "Camel",
      "Olive",
      "Cream",
    ],
    confidence: 0.55,
    userEdited: false,
  }),

  recommend_outfits: () => ({
    outfits: [0, 1, 2, 3, 4].map((i) => outfitSet(i)),
    analysis: null,
    summary:
      "Based on your event and look, here are five complete outfits. The first two are the strongest matches — they balance formality with comfort and stay within a typical budget.",
  }),

  extract_wardrobe: () => ({
    items: [
      { name: "White Oxford Shirt", category: "tops", color: "#ffffff", timesWorn: 12, tags: ["formal", "classic"] },
      { name: "Slim Denim Jeans", category: "bottoms", color: "#1d4ed8", timesWorn: 20, tags: ["casual"] },
      { name: "Navy Blazer", category: "outerwear", color: "#1e3a8a", timesWorn: 8, tags: ["smart-casual"] },
      { name: "Brown Loafers", category: "footwear", color: "#7c4a1e", timesWorn: 9, tags: ["formal"] },
    ],
    moneySaved: 8600,
    wardrobeUtilization: 74,
    totalItems: 4,
    itemsUsed: 3,
  }),

  packing_list: (req) => {
    const text = req.messages.map((m) => m.content).join("\n");
    const isBeach = /beach|trip|vacation|holiday/i.test(text);
    const duration = /\b(\d+)\s*(?:day|days|night|nights)\b/i.exec(text)?.[1] ?? "3";
    return {
      id: `packing-demo-${Date.now()}`,
      title: `${isBeach ? "Beach" : "City"} Getaway`,
      destination: "Demo Destination",
      startDate: null,
      endDate: null,
      items: [
        { name: `Shirts / T-shirts (${Number(duration) + 1})`, category: "clothing", quantity: Number(duration) + 1, essential: true },
        { name: "Trousers / Shorts", category: "clothing", quantity: 3, essential: true },
        { name: "Sneakers", category: "shoes", quantity: 1, essential: true },
        { name: isBeach ? "Flip-flops" : "Formal Shoes", category: "shoes", quantity: 1, essential: false },
        { name: "Toiletry Kit", category: "toiletries", quantity: 1, essential: true },
        { name: "Charger & Power Bank", category: "tech", quantity: 1, essential: true },
        { name: "Travel Documents", category: "documents", quantity: 1, essential: true },
      ],
      weatherBasedAdjustments: ["Light jacket for evenings", "Carry a compact umbrella"],
      activities: [],
      createdAt: new Date().toISOString(),
    };
  },

  couple_style: () => ({
    memberA: {
      id: "member-a",
      name: "Partner A",
      photo: null,
      bodyAnalysis: null,
      preferredColors: ["Navy", "White"],
    },
    memberB: {
      id: "member-b",
      name: "Partner B",
      photo: null,
      bodyAnalysis: null,
      preferredColors: ["Maroon", "Beige"],
    },
    colorPalette: { name: "Complementary Neutrals", colors: ["#0f172a", "#f8fafc", "#b45309"] },
    matchingOutfits: [
      { person: "A", outfit: outfitSet(1) },
      { person: "B", outfit: outfitSet(3) },
    ],
    sharedShoppingList: [
      {
        type: "accessory",
        name: "Matching Beaded Bracelets",
        brand: null,
        color: "#b45309",
        price: 499,
        currency: "INR",
        buyUrl: null,
        imageUrl: null,
        reason: "Coordinates both looks together.",
      },
      {
        type: "accessory",
        name: "Coordinating Pocket Square & Scarf",
        brand: null,
        color: "#0f172a",
        price: 699,
        currency: "INR",
        buyUrl: null,
        imageUrl: null,
        reason: "Ties the two outfits into one shared palette.",
      },
    ],
  }),

  group_style: () => {
    const members = [
      { id: "member-1", name: "Member 1", photo: null, bodyAnalysis: null, preferredColors: ["#7f1d1d"] },
      { id: "member-2", name: "Member 2", photo: null, bodyAnalysis: null, preferredColors: ["#c2410c"] },
      { id: "member-3", name: "Member 3", photo: null, bodyAnalysis: null, preferredColors: ["#f59e0b"] },
    ];
    return {
      members,
      colorPalette: { name: "Warm Gradient", colors: ["#7f1d1d", "#c2410c", "#f59e0b", "#facc15"] },
      theme: "Coordinated sunset tones with personal variation",
      outfits: members.map((m, index) => ({ memberId: m.id, outfit: outfitSet(index) })),
      shoppingList: [
        {
          type: "accessory",
          name: "Shared Pocket Square Set",
          brand: null,
          color: "#c2410c",
          price: 599,
          currency: "INR",
          buyUrl: null,
          imageUrl: null,
          reason: "One accent item everyone can wear.",
        },
        {
          type: "accessory",
          name: "Cufflink & Tie Bar Set",
          brand: null,
          color: "#facc15",
          price: 799,
          currency: "INR",
          buyUrl: null,
          imageUrl: null,
          reason: "Pulls the palette together for formal members.",
        },
      ],
    };
  },

  sustainability: () => ({
    ecoScore: 78,
    carbonSavedKg: 12.4,
    moneySaved: 8600,
    itemsReused: 14,
    mixAndMatchOutfits: 9,
    costPerWearAverage: 86,
  }),

  price_summary: () => ({
    lowestPrice: { store: "Flipkart", price: 1299 },
    highestRated: { store: "Amazon", rating: 4.6 },
    fastestDelivery: { store: "Myntra", days: 2 },
    bestValue: { store: "Ajio", price: 1349, rating: 4.5 },
  }),

  teaching: () => ({
    topic: "Color Matching Basics",
    lesson:
      "Start with 60% neutral base, 30% a secondary tone, and 10% an accent. Neutrals like navy, grey, beige, and white pair with almost anything.",
  }),
};

/**
 * Build Your Look demo styling guidance. Only used when AI_PROVIDER=mock.
 */
const DEMO_LOOK_ITEMS: Record<string, unknown>[] = [
  {
    id: "demo-upperwear-1",
    name: "Lightweight tailored shirt in crisp white",
    subtitle: "Breathable everyday layer",
    description:
      "A relaxed-tailored shirt in warm white that layers cleanly and stays comfortable across the event.",
    material: "Breathable cotton or cotton blend",
    color: "Warm white",
    size: "Regular fit, your usual size",
    category: "upperwear",
  },
  {
    id: "demo-lowerwear-1",
    name: "Slim tailored chinos in deep navy",
    subtitle: "Polished base piece",
    description:
      "Mid-rise chinos with a clean line to balance smart-casual styling without feeling too formal.",
    material: "Cotton twill with slight stretch",
    color: "Deep navy",
    size: "Tailored fit, your usual waist",
    category: "lowerwear",
  },
  {
    id: "demo-footwear-1",
    name: "Minimal leather sneakers in white",
    subtitle: "Clean, modern footwear",
    description:
      "Low-profile sneakers that keep the look modern while remaining easy to wear throughout the day.",
    material: "Smooth leather or leather-look upper",
    color: "White",
    size: "Your usual shoe size",
    category: "footwear",
  },
  {
    id: "demo-accessories-1",
    name: "Slim leather belt in dark brown",
    subtitle: "Subtle anchor piece",
    description:
      "A simple belt to finish the waistline and tie the outfit together without drawing attention.",
    material: "Leather",
    color: "Dark brown",
    size: "Matched to your waist size",
    category: "accessories",
  },
  {
    id: "demo-accessories-2",
    name: "Classic analog watch with neutral strap",
    subtitle: "Refined finishing touch",
    description:
      "A clean dial watch that adds polish while staying understated for the occasion.",
    material: "Metal case with leather or neutral strap",
    color: "Black or charcoal strap",
    size: "One size",
    category: "accessories",
  },
];

function eventNameFromInstruction(req: AIRequest): string | undefined {
  const text = req.messages.map((m) => m.content).join("\n");
  return /Event name:\s*(.+)/i.exec(text)?.[1]?.trim();
}

function weatherNoteFromInstruction(req: AIRequest): string | undefined {
  const text = req.messages.map((m) => m.content).join("\n");
  const match = /Real weather context \(provided by client\): ([^.]+)\./i.exec(text);
  return match ? `Guidance considers the provided weather: ${match[1].trim()}.` : undefined;
}

function demoGrooming(): Record<string, unknown> {
  return {
    summary:
      "Demo grooming suggestions matched to a polished everyday look. Swap these for your usual products.",
    items: [
      {
        category: "hair",
        title: "Neat, low-effort side part",
        why: "Keeps the silhouette clean and matches the crisp shirt collar.",
        tip: "Blow-dry damp hair with a small amount of matte cream, then comb it into place.",
        estimatedPriceInr: 450,
      },
      {
        category: "facial",
        title: "Clean shave or tidy stubble",
        why: "A defined jawline reads sharper against the structured chinos.",
        tip: "Trim to an even length first, then shave only the neck and cheek lines.",
        estimatedPriceInr: 300,
      },
      {
        category: "skin",
        title: "Lightweight mattifying prep",
        why: "Keeps photos from looking shiny without adding visible coverage.",
        tip: "Cleanse, moisturise, then pat a tiny amount of mattifying primer on the T-zone.",
        estimatedPriceInr: 650,
      },
      {
        category: "accessory",
        title: "Minimal leather watch or bracelet",
        why: "Adds a polished finishing touch that echoes the leather belt.",
        tip: "Match the metal tone to the buckle where possible and keep it to one piece.",
        estimatedPriceInr: 1500,
      },
      {
        category: "fragrance",
        title: "Fresh woody eau de parfum",
        why: "Light and versatile; it suits daytime events and close spaces.",
        tip: "Apply one spray to the chest and one behind the neck before dressing.",
        estimatedPriceInr: 1899,
      },
    ],
  };
}

function demoLook(
  eventName: string | undefined,
  items: Record<string, unknown>[],
  weatherNote?: string,
) {
  return {
    eventName: eventName ?? "Your Event",
    styleName: "Polished Everyday",
    styleMatch: 92,
    eventMatch: 90,
    colorCombination:
      "Start with warm white and deep navy, then add dark brown and subtle neutral accents for balance.",
    footwear: "Keep footwear clean and minimal in white leather sneakers to ground the smart-casual look.",
    accessories: [
      "Add a dark brown slim leather belt to define the waistline.",
      "Finish with a classic analog watch in a neutral strap for understated polish.",
    ],
    explanation:
      "This direction reads polished and comfortable: breathable layers up top, tailored structure below, and restrained accessories that work across casual-to-smart occasions.",
    ...(weatherNote ? { weatherNote } : {}),
    items,
  };
}

function parseContextItems(req: AIRequest): Record<string, unknown>[] {
  const text = req.messages.map((m) => m.content).join("\n");
  const block = /Current outfit:\n([\s\S]*?)(?:\n\n|$)/.exec(text)?.[1];
  if (!block) return [];
  return block
    .split("\n")
    .map((line) => /^(.*?)\| (.*)$/.exec(line.trim())?.[1]?.trim())
    .filter((id): id is string => Boolean(id))
    .map((id) => DEMO_LOOK_ITEMS.find((i) => i.id === id))
    .filter((i): i is Record<string, unknown> => Boolean(i));
}

function wantsGrooming(req: AIRequest): boolean {
  const text = req.messages.map((m) => m.content).join("\n");
  return /"grooming"\s*:/.test(text);
}

Object.assign(TASK_RESPONSES, {
  build_your_look: (req: AIRequest) => {
    const look = demoLook(
      eventNameFromInstruction(req),
      DEMO_LOOK_ITEMS,
      weatherNoteFromInstruction(req),
    );
    return wantsGrooming(req) ? { ...look, grooming: demoGrooming() } : look;
  },

  build_your_look_replace: (req: AIRequest) => {
    const current = parseContextItems(req);
    const base = current.length > 0 ? current : DEMO_LOOK_ITEMS;
    const text = req.messages.map((m) => m.content).join("\n");
    const targetId = /Replace ONLY the item with id "([^"]+)"/.exec(text)?.[1];
    const swapped = base.map((item) =>
      item.id === targetId
        ? {
            ...DEMO_LOOK_ITEMS[(base.length + 1) % DEMO_LOOK_ITEMS.length],
            id: item.id,
          }
        : item,
    );
    return demoLook(eventNameFromInstruction(req), swapped, weatherNoteFromInstruction(req));
  },

  build_your_look_add: (req: AIRequest) => {
    const current = parseContextItems(req);
    const base = current.length > 0 ? current : DEMO_LOOK_ITEMS;
    const extra = DEMO_LOOK_ITEMS.find((i) => !base.some((b) => b.id === i.id));
    return demoLook(
      eventNameFromInstruction(req),
      extra ? [...base, { ...extra, id: `demo-added-${Date.now()}` }] : base,
      weatherNoteFromInstruction(req),
    );
  },
});

export class MockProvider implements AIProviderPort {
  readonly name = "mock" as const;
  readonly isConfigured = true;
  readonly description = "Demo provider (no external API needed)";

  async chat(req: AIRequest): Promise<AIResponse> {
    const responder = TASK_RESPONSES[req.task];
    const result = responder ? responder(req) : this.defaultChat(req);
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return { text, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  /**
   * Demo-only: emits the canned text in word-sized deltas so the chat UI can
   * exercise its streaming path. Only reached when AI_PROVIDER=mock.
   */
  async *stream(req: AIRequest): AsyncGenerator<string, void, unknown> {
    const { text } = await this.chat(req);
    for (const chunk of text.match(/\S+\s*/g) ?? [text]) {
      yield chunk;
      if (chunk.length > 24) await new Promise((r) => setTimeout(r, 8));
    }
  }

  private defaultChat(req: AIRequest): string {
    const last = req.messages.filter((m) => m.role !== "system").at(-1);
    const userText = last?.content ?? "";
    if (userText.length === 0) {
      return "Hello! I'm your StylAIze stylist. Tell me where you're going — a wedding, an interview, a date — and I'll build your look.";
    }
    const detected = extractJson(this.buildJson(req, { event: detectEventFromText(userText) }));
    const event = (detected.event as { name?: string } | undefined) ?? {};
    return [
      `Got it — ${event.name ?? "your event"} it is.`,
      "Here's my initial plan: build one polished primary look plus two alternates, keep it comfortable for the full duration, and reuse pieces you already own where possible.",
      "A few quick questions to fine-tune: 1) Indoor or outdoor? 2) Formal or semi-formal? 3) Any colors you want to avoid? 4) Rough budget per outfit?",
    ].join("\n");
  }

  private buildJson(_req: AIRequest, data: Record<string, unknown>): string {
    return JSON.stringify(data);
  }
}

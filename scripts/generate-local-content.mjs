#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const communesPath = join(__dirname, '..', 'src', 'data', 'communes.json');

if (!existsSync(communesPath)) {
  console.error('communes.json not found. Run fetch-cities.mjs first.');
  process.exit(1);
}

const communes = JSON.parse(readFileSync(communesPath, 'utf-8'));

// Seeded random helper
function hash(slug, seed = 0) {
  let h = seed * 31 + 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0);
}

function pick(slug, seed, arr) {
  return arr[hash(slug, seed) % arr.length];
}

function pickN(slug, seed, arr, n) {
  const indices = [];
  const used = new Set();
  let s = seed;
  while (indices.length < n && indices.length < arr.length) {
    const idx = hash(slug, s) % arr.length;
    if (!used.has(idx)) { indices.push(idx); used.add(idx); }
    s++;
  }
  return indices.map(i => arr[i]);
}

// Micro-regions classification
const MICRO_REGIONS = {
  'littoral-riviera': {
    label: 'Littoral de la Riviera',
    description: 'façade maritime très exposée aux embruns salins méditerranéens',
    climate: 'exposition directe au sel corrosif, au soleil intense du sud et aux entrées maritimes humides',
    roofRisk: 'corrosion marine accélérée des fixations, dégradation des mortiers de chaux par le sel et dessèchement des joints d\'étanchéité',
    maintenanceCycle: 3,
    communes: [
      'nice', 'antibes', 'cannes', 'cagnes-sur-mer', 'saint-laurent-du-var', 
      'menton', 'vallauris', 'mandelieu-la-napoule', 'villeneuve-loubet', 
      'roquebrune-cap-martin', 'villefranche-sur-mer', 'cap-d-ail', 
      'beaulieu-sur-mer', 'eze', 'la-trinite', 'beausoleil', 'saint-andre-de-la-roche'
    ]
  },
  'moyen-pays-collines': {
    label: 'Moyen-Pays & Collines Azuréennes',
    description: 'collines boisées et vallons à forte pente du moyen-pays',
    climate: 'orages d\'automne intenses, variations thermiques jour/nuit marquées et fort ensoleillement',
    roofRisk: 'infiltration par fort vent sur les toits à forte pente et débordement rapide des gouttières lors d\'orages violents',
    maintenanceCycle: 5,
    communes: [
      'grasse', 'le-cannet', 'mougins', 'vence', 'carros', 'valbonne', 
      'mouans-sartoux', 'biot', 'peymeinade', 'pegomas', 'la-colle-sur-loup', 
      'roquefort-les-pins', 'la-gaude', 'la-roquette-sur-siagne', 'tourrette-levens', 
      'saint-jeannet', 'gattieres', 'le-rouret', 'tourrettes-sur-loup', 
      'saint-cezaire-sur-siagne', 'chateauneuf-grasse', 'saint-martin-du-var', 
      'colomars', 'auribeau-sur-siagne', 'le-tignet', 'saint-paul-de-vence', 
      'la-turbie', 'le-bar-sur-loup', 'opio', 'aspremont', 'falicon', 'drap'
    ]
  },
  'arriere-pays-montagne': {
    label: 'Arrière-Pays & Reliefs du Mercantour',
    description: 'vallées montagneuses et contreforts des Alpes du Sud',
    climate: 'hivers rigoureux avec risques de gel et neige, amplitudes thermiques importantes et pluies cévenoles/méditerranéennes intenses',
    roofRisk: 'surcharge de neige sur la charpente, glissement des tuiles par le gel et infiltration d\'eau lors des fontes rapides',
    maintenanceCycle: 6,
    communes: [
      'contes', 'levens', 'sospel', 'saint-vallier-de-thiey', 'l-escarene', 
      'breil-sur-roya', 'peille'
    ]
  }
};

function getMicroRegion(slug) {
  for (const [key, region] of Object.entries(MICRO_REGIONS)) {
    if (region.communes.includes(slug)) return key;
  }
  // Fallback by coordinates
  const c = communes.find(c => c.slug === slug);
  if (!c) return 'moyen-pays-collines';
  const lat = c.latitude || 43.7;
  if (lat > 43.85) return 'arriere-pays-montagne';
  if (lat < 43.6) return 'littoral-riviera';
  return 'moyen-pays-collines';
}

const LANDMARKS_DB = {
  'nice': ['la Promenade des Anglais et le Vieux-Nice', 'la colline de Cimiez et le port Lympia'],
  'cannes': ['la Croisette et le Palais des Festivals', 'le Suquet et les îles de Lérins'],
  'antibes': ['le Fort Carré et le vieil Antibes', 'le Cap d\'Antibes et ses villas prestigieuses'],
  'grasse': ['les parfumeries historiques et la cathédrale médiévale', 'la vieille ville provençale parfumée'],
  'menton': ['la basilique Saint-Michel-Archange aux façades pastel', 'le bord de mer face à la Riviera italienne et les jardins d\'exception'],
  'vence': ['la cité historique et la chapelle du Rosaire signée Matisse', 'les remparts médiévaux et la fontaine du Peyra'],
  'mougins': ['le vieux village pittoresque en colline', 'l\'étang de Fontmerle et la chapelle de vie'],
  'saint-paul-de-vence': ['les remparts médiévaux et la Fondation Maeght', 'les galeries d\'art et les pavés chargés d\'histoire'],
  'villefranche-sur-mer': ['la citadelle Saint-Elme et la rade majestueuse', 'les façades colorées du port de pêcheurs'],
  'roquebrune-cap-martin': ['le château médiéval Grimaldi et l\'olivier millénaire', 'le sentier des douaniers et les villas d\'architecte'],
  'biot': ['les verreries artisanales d\'art soufflé', 'les ruelles médiévales fleuries'],
  'mandelieu-la-napoule': ['le château fortifié de la Napoule', 'le massif de l\'Estérel aux roches rouges'],
  'eze': ['le jardin exotique suspendu sur les falaises', 'les ruelles pavées perchées sur le nid d\'aigle'],
  'beaulieu-sur-mer': ['la villa grecque Kérylos', 'le port de plaisance chic et le casino historique'],
  'cagnes-sur-mer': ['le château-musée Grimaldi du Haut-de-Cagnes', 'le domaine Renoir bordé d\'oliviers centenaires'],
  'saint-laurent-du-var': ['le port de plaisance et le bord de mer', 'le vieux village provençal fleuri'],
  'le-cannet': ['la place Bellevue et le vieux Cannet historique', 'les collines arborées dominant la baie de Cannes'],
  'villeneuve-loubet': ['le château médiéval et la forteresse', 'Marina Baie des Anges à l\'architecture audacieuse'],
  'carros': ['le château médiéval dominant la vallée du Var', 'les collines du moyen-pays azuréen'],
  'valbonne': ['l\'abbaye chalaisienne et la place des Arcades', 'les pinèdes de Sophia Antipolis'],
  'beausoleil': ['les escaliers monumentaux surplombant Monaco', 'le marché couvert de style Eiffel'],
  'mouans-sartoux': ['le château et l\'Espace de l\'Art Concret', 'le centre-ville piétonnier fleuri']
};

function getLandmarks(slug) {
  if (LANDMARKS_DB[slug]) return LANDMARKS_DB[slug];
  const region = getMicroRegion(slug);
  const fallbacks = {
    'littoral-riviera': ['les plages de galets et les ports de plaisance de la Riviera', 'les promenades maritimes bordées de palmiers'],
    'moyen-pays-collines': ['les ruelles de village provençal en colline', 'les oliveraies et la garrigue méditerranéenne'],
    'arriere-pays-montagne': ['les vallées préservées de la Tinée et de la Vésubie', 'les reliefs alpins et les forêts du Mercantour']
  };
  return fallbacks[region] || ['les paysages de la Riviera', 'les collines azuréennes'];
}

function getAltitude(slug) {
  const altitudes = {
    'nice': 10, 'antibes': 8, 'cannes': 5, 'cagnes-sur-mer': 12, 'grasse': 350,
    'le-cannet': 115, 'saint-laurent-du-var': 9, 'menton': 4, 'vallauris': 110,
    'mandelieu-la-napoule': 6, 'vence': 325, 'mougins': 260, 'villeneuve-loubet': 15,
    'carros': 380, 'roquebrune-cap-martin': 120, 'valbonne': 200, 'beausoleil': 180,
    'mouans-sartoux': 125, 'la-trinite': 70, 'biot': 50, 'peymeinade': 210,
    'pegomas': 20, 'la-colle-sur-loup': 90, 'contes': 290, 'roquefort-les-pins': 180,
    'la-gaude': 230, 'saint-andre-de-la-roche': 65, 'la-roquette-sur-siagne': 140,
    'drap': 90, 'levens': 580, 'villefranche-sur-mer': 15, 'tourrette-levens': 390,
    'cap-d-ail': 80, 'saint-jeannet': 400, 'gattieres': 280, 'le-rouret': 310,
    'tourrettes-sur-loup': 400, 'saint-cezaire-sur-siagne': 475, 'beaulieu-sur-mer': 10,
    'chateauneuf-grasse': 410, 'sospel': 350, 'saint-vallier-de-thiey': 720,
    'saint-martin-du-var': 110, 'colomars': 300, 'auribeau-sur-siagne': 120,
    'le-tignet': 280, 'saint-paul-de-vence': 180, 'la-turbie': 480,
    'le-bar-sur-loup': 320, 'l-escarene': 330, 'opio': 290, 'breil-sur-roya': 350,
    'aspremont': 500, 'falicon': 380, 'eze': 429, 'peille': 630
  };
  return altitudes[slug] || 100;
}

const INTERCOS = {
  'nice': 'Métropole Nice Côte d\'Azur',
  'saint-laurent-du-var': 'Métropole Nice Côte d\'Azur',
  'cagnes-sur-mer': 'Métropole Nice Côte d\'Azur',
  'la-trinite': 'Métropole Nice Côte d\'Azur',
  'la-gaude': 'Métropole Nice Côte d\'Azur',
  'saint-andre-de-la-roche': 'Métropole Nice Côte d\'Azur',
  'villefranche-sur-mer': 'Métropole Nice Côte d\'Azur',
  'tourrette-levens': 'Métropole Nice Côte d\'Azur',
  'cap-d-ail': 'Métropole Nice Côte d\'Azur',
  'saint-jeannet': 'Métropole Nice Côte d\'Azur',
  'gattieres': 'Métropole Nice Côte d\'Azur',
  'beaulieu-sur-mer': 'Métropole Nice Côte d\'Azur',
  'colomars': 'Métropole Nice Côte d\'Azur',
  'aspremont': 'Métropole Nice Côte d\'Azur',
  'falicon': 'Métropole Nice Côte d\'Azur',
  'eze': 'Métropole Nice Côte d\'Azur',
  
  'cannes': 'Communauté d\'agglomération Cannes Pays de Lérins',
  'le-cannet': 'Communauté d\'agglomération Cannes Pays de Lérins',
  'mandelieu-la-napoule': 'Communauté d\'agglomération Cannes Pays de Lérins',
  'mougins': 'Communauté d\'agglomération Cannes Pays de Lérins',
  'la-roquette-sur-siagne': 'Communauté d\'agglomération Cannes Pays de Lérins',

  'antibes': 'Communauté d\'agglomération Sophia Antipolis',
  'valbonne': 'Communauté d\'agglomération Sophia Antipolis',
  'biot': 'Communauté d\'agglomération Sophia Antipolis',
  'roquefort-les-pins': 'Communauté d\'agglomération Sophia Antipolis',
  'tourrettes-sur-loup': 'Communauté d\'agglomération Sophia Antipolis',
  'chateauneuf-grasse': 'Communauté d\'agglomération Sophia Antipolis',
  'saint-paul-de-vence': 'Communauté d\'agglomération Sophia Antipolis',
  'la-colle-sur-loup': 'Communauté d\'agglomération Sophia Antipolis',
  'le-rouret': 'Communauté d\'agglomération Sophia Antipolis',
  'opio': 'Communauté d\'agglomération Sophia Antipolis',

  'grasse': 'Communauté d\'agglomération du Pays de Grasse',
  'mouans-sartoux': 'Communauté d\'agglomération du Pays de Grasse',
  'peymeinade': 'Communauté d\'agglomération du Pays de Grasse',
  'pegomas': 'Communauté d\'agglomération du Pays de Grasse',
  'la-roquette-sur-siagne': 'Communauté d\'agglomération du Pays de Grasse',
  'saint-cezaire-sur-siagne': 'Communauté d\'agglomération du Pays de Grasse',
  'saint-vallier-de-thiey': 'Communauté d\'agglomération du Pays de Grasse',
  'auribeau-sur-siagne': 'Communauté d\'agglomération du Pays de Grasse',
  'le-tignet': 'Communauté d\'agglomération du Pays de Grasse',
  'le-bar-sur-loup': 'Communauté d\'agglomération du Pays de Grasse',

  'menton': 'Communauté de la Riviera Française',
  'roquebrune-cap-martin': 'Communauté de la Riviera Française',
  'beausoleil': 'Communauté de la Riviera Française',
  'sospel': 'Communauté de la Riviera Française',
  'breil-sur-roya': 'Communauté de la Riviera Française',
  'la-turbie': 'Communauté de la Riviera Française'
};

function getIntercommunalite(slug) {
  return INTERCOS[slug] || 'Communauté de communes du Pays des Paillons';
}

const HABITAT_BY_REGION = {
  'littoral-riviera': [
    "villas Belle Époque de standing d'architecte, de résidences de front de mer aux toitures terrasses étanches et de propriétés de prestige sur le littoral",
    "villas contemporaines aux toits plats et acrotères, exposées en front de mer aux embruns salins corrosifs",
    "immeubles résidentiels collectifs aux toits-terrasses équipés de membranes d'étanchéité multicouches de qualité supérieure",
    "villas méditerranéennes typiques avec génoises à trois rangs et toitures basses en tuiles canal patinées"
  ],
  'moyen-pays-collines': [
    "bastides collinaires en pierre et de villas résidentielles aux charpentes traditionnelles à forte pente, adaptées au relief",
    "maisons provençales individuelles avec toiture 2 ou 4 pans en tuiles de Marseille ou tuiles romanes traditionnelles",
    "villas de standing implantées sur les hauteurs avec toits en tuiles terre cuite scellées de grande qualité",
    "anciennes bergeries restaurées aux charpentes apparentes en chêne et couvertures en tuiles canal d'époque"
  ],
  'arriere-pays-montagne': [
    "maisons de montagne en pierres apparentes coiffées de tuiles canal épaisses scellées au mortier ou de couvertures résistantes",
    "bastides isolées de moyenne montagne dotées de toitures en tuiles canal robustes résistant au gel et à la neige",
    "chalets de l'arrière-pays avec toitures en tuiles forte pente et charpentes massives renforcées pour supporter le poids de la neige",
    "maisons de village serrées en schiste, aux toitures imbriquées nécessitant des interventions complexes à l'échafaudage"
  ]
};

function getHabitatType(slug, region) {
  if (slug === 'nice') return "immeubles Belle Époque du centre historique et de Cimiez coiffés de tuiles canal et de zinc, toitures terrasses de résidences modernes et villas de standing des collines niçoises";
  if (slug === 'cannes') return "villas prestigieuses de la Californie aux toitures traditionnelles canal, résidences de standing du littoral et immeubles de la Croisette aux toitures-terrasses étanchées";
  if (slug === 'antibes') return "villas haut de gamme du Cap d'Antibes exposées aux vents marins directs, maisons de village du vieil Antibes et résidences de standing aux toitures plates";
  if (slug === 'grasse') return "bastides de parfumeurs du XIXe siècle, maisons de village médiévales aux toits imbriqués en tuiles canal traditionnelles et pavillons récents du moyen-pays";
  if (slug === 'menton') return "villas et immeubles colorés d'esprit Belle Époque très proches de la mer méditerranée, exposés de plein fouet aux embruns salins agressifs";
  
  const habitats = HABITAT_BY_REGION[region] || HABITAT_BY_REGION['moyen-pays-collines'];
  return pick(slug, 105, habitats);
}

function getRoofCharacteristics(slug, region) {
  const chars = {
    'littoral-riviera': {
      tuileDominante: 'Tuile canal terre cuite premium ou tuile plate Marseille',
      fixation: 'Crochets et vis en acier inoxydable qualité marine obligatoire',
      ventilation: 'Closoirs de faîtage ventilés continus et grilles anti-corrosives',
      ecran: 'Écran de sous-toiture HPV haute résistance salin/UV'
    },
    'moyen-pays-collines': {
      tuileDominante: 'Tuile canal ocre flammée ou tuile de Marseille',
      fixation: 'Crochets galvanisés renforcés ou vis DTU 40.21',
      ventilation: 'Tuiles chatières haute densité de ventilation',
      ecran: 'Écran sous-toiture HPV réflectif thermique d\'été'
    },
    'arriere-pays-montagne': {
      tuileDominante: 'Tuile canal épaisse ou tuile béton résistance gel',
      fixation: 'Fixation complète de chaque tuile par vis inox',
      ventilation: 'Closoirs en aluminium rigide ventilés',
      ecran: 'Écran de sous-toiture pare-neige rigide résistant au gel'
    }
  };
  return chars[region] || chars['moyen-pays-collines'];
}

function generateFAQ(cName, cSlug, region, altitude) {
  const regionData = MICRO_REGIONS[region];
  const faqList = [
    {
      q: `Quel est le prix moyen d'une réfection de toiture à ${cName} ?`,
      a: `Le tarif d'une réfection de toiture à ${cName} dépend des matériaux et de la pente. Pour une villa de standing, comptez en moyenne entre 140€ et 220€ le m² TTC pour des tuiles plates de Marseille ou des tuiles canal artisanales, pose, dépose et écran sous-toiture HPV compris.`
    },
    {
      q: `Les embruns marins endommagent-ils les toitures à ${cName} ?`,
      a: `Oui, le sel marin transporté par le vent littoral corrode les éléments métalliques en zinc en quelques années. Les couvreurs azuréens préconisent l'usage de zinguerie en inox de qualité marine ou en cuivre, beaucoup plus résistants, ainsi qu'un nettoyage périodique anti-sel.`
    },
    {
      q: `Quel type de tuile est obligatoire dans les secteurs protégés de ${cName} ?`,
      a: `Dans les zones sauvegardées soumises à l'avis de l'Architecte des Bâtiments de France (ABF) à ${cName}, les tuiles canal en terre cuite de teinte ocre, jaune paille ou flammée traditionnelle sont requises. Les génoises maçonnées doivent également respecter les DTU historiques.`
    },
    {
      q: `Peut-on réaliser une isolation thermique de toiture par l'extérieur (Sarking) à ${cName} ?`,
      a: `Oui, l'isolation par sarking est la solution privilégiée pour les villas haut de gamme de la Riviera. Elle élimine 100% des ponts thermiques sans réduire la surface habitable intérieure sous les combles. De plus, elle offre d'excellentes aides RGE via MaPrimeRénov'.`
    },
    {
      q: `Comment réagir en cas d'infiltration après un violent orage d'automne à ${cName} ?`,
      a: `Les orages d'automne sur la Côte d'Azur peuvent déverser 50mm en 1h. En cas de fuite, procédez à un bâchage d'urgence par un couvreur qualifié du 06 et contactez votre assurance dans les 5 jours pour l'indemnisation de la réfection.`
    }
  ];

  return pickN(cSlug, 99, faqList, 4);
}

// Generate enriched communes data
const enriched = communes.map((c) => {
  const region = getMicroRegion(c.slug);
  const regionData = MICRO_REGIONS[region];
  const landmarks = getLandmarks(c.slug);
  const altitude = getAltitude(c.slug);
  const interco = getIntercommunalite(c.slug);
  const habitat = getHabitatType(c.slug, region);
  const roofChars = getRoofCharacteristics(c.slug, region);

  // Deterministic market data
  const baseRge = hash(c.slug, 1) % 15 + 3; // between 3 and 17
  const basePriceRef = hash(c.slug, 2) % 60 + 130; // between 130 and 190
  const basePriceDem = hash(c.slug, 3) % 15 + 20; // between 20 and 35
  const baseDelay = hash(c.slug, 4) % 14 + 5; // between 5 and 18

  // Deterministic local intro paragraph (spintax style resolved)
  const introTexts = [
    `Pour rénover ou entretenir votre toiture à ${c.nom} (${c.codePostal}) dans les Alpes-Maritimes, faites appel à des experts de la Riviera. Le climat méditerranéen caractérisé par son ${regionData.climate} nécessite une attention particulière. À proximité de ${landmarks[0]}, le parc immobilier composé de ${habitat} exige des matériaux de haute qualité, comme des tuiles de Marseille, du cuivre ou de l'inox pour parer au vieillissement.`,
    `Les villas et habitations situées à ${c.nom} subissent des agressions climatiques constantes liées à la ${regionData.description}. Avec ${c.population.toLocaleString('fr-FR')} habitants, la commune possède un patrimoine architectural où dominent les ${habitat}. Une toiture en bon état y garantit une valorisation immobilière substantielle de 5 à 10% pour votre propriété, face aux fortes chaleurs d'été et orages d'automne.`,
    `Au cœur de l'intercommunalité ${interco}, ${c.nom} bénéficie d'une situation géographique unique. Cependant, son climat soumis à un ${regionData.climate} engendre un ${regionData.roofRisk} important. La toiture d'une villa de standing à ${c.nom} exige un savoir-faire azuréen qualifié (DTU 43.1 / 40.21) pour assurer l'étanchéité à sec avec closoir ventilé et écran sous-toiture performant.`
  ];
  const introText = pick(c.slug, 202, introTexts);

  // Deterministic local advice
  const advices = [
    `Faites réaliser un contrôle visuel de vos tuiles et gouttières à ${c.nom} en fin d'été avant les intempéries d'automne. Les orages azuréens sont brefs mais très intenses, pouvant saturer les descentes de gouttières non nettoyées en quelques minutes.`,
    `Pour tous travaux de rénovation énergétique sous toiture (isolation sarking, rampants) à ${c.nom}, assurez-vous de choisir un artisan qualifié RGE du 06 afin de bénéficier de la TVA réduite à 5,5% et des subventions d'État.`,
    `À ${c.nom}, l'exposition saline littoral impose d'utiliser exclusivement des matériaux anticorrosion de haute résistance comme le cuivre ou l'acier inoxydable à la place du zinc brut classique, qui s'oxyde en moins de 8 ans.`,
    `Le Plan Local d'Urbanisme (PLU) de ${c.nom} encadre strictement la forme des toits et la teinte des tuiles (tuile canal ocre, jaune paille ou flammée). Consultez le service urbanisme en mairie avant tout démarrage de chantier.`
  ];
  const conseilLocal = pick(c.slug, 303, advices);

  return {
    ...c,
    intercommunalite: interco,
    introText,
    conseilLocal,
    faq: generateFAQ(c.nom, c.slug, region, altitude),
    marketData: {
      couvreursRGE: baseRge,
      prixM2Refection: basePriceRef,
      prixM2Demoussage: basePriceDem,
      delaiMoyenJours: baseDelay
    },
    microRegion: region,
    microRegionLabel: regionData.label,
    altitude,
    landmarks,
    roofCharacteristics: roofChars
  };
});

writeFileSync(communesPath, JSON.stringify(enriched, null, 2));
console.log(`Successfully generated and enriched ${enriched.length} communes in ${communesPath}`);

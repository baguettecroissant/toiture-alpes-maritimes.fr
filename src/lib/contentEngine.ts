import communes from '../data/communes.json';
import { getSmartNearbyCommunes } from './geoLinks';

export interface Commune {
  nom: string;
  slug: string;
  codeInsee: string;
  codePostal: string;
  population: number;
  latitude?: number;
  longitude?: number;
  intercommunalite?: string;
  introText?: string;
  conseilLocal?: string;
  faq?: { q: string; a: string }[];
  marketData?: {
    couvreursRGE: number;
    prixM2Refection: number;
    prixM2Demoussage: number;
    delaiMoyenJours: number;
  };
  microRegion?: string;
  microRegionLabel?: string;
  altitude?: number;
  landmarks?: string[];
  roofCharacteristics?: {
    tuileDominante: string;
    fixation: string;
    ventilation: string;
    ecran: string;
  };
}

export function getDynamicPrices(commune: Commune) {
  const rPrice = commune.marketData?.prixM2Refection || 150;
  const dPrice = commune.marketData?.prixM2Demoussage || 25;
  
  return {
    refectionMarseille: { min: Math.round(rPrice * 0.95), max: Math.round(rPrice * 1.35) },
    refectionCanal: { min: Math.round(rPrice * 1.10), max: Math.round(rPrice * 1.50) },
    refectionTerrasse: { min: 80, max: 150 },
    demoussageHydro: { min: Math.round(dPrice * 0.85), max: Math.round(dPrice * 1.30) },
    reparationFuite: { min: 400, max: 2000 },
    faitageMl: { min: 40, max: 80 },
    zinguerieMl: { min: 80, max: 150 },
    isolationSarking: { min: 110, max: 190 },
    charpenteExotique: { min: 100, max: 180 },
    refectionVilla: { min: 200, max: 350 }
  };
}

class SeededRandom {
  private state: number;

  constructor(seedStr: string) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    this.state = h >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export function parseSpintax(slug: string, key: string, template: string): string {
  const prng = new SeededRandom(slug + "-" + key);
  let text = template;
  
  const braceRegex = /\{([^{}]+)\}/;
  let match;
  while ((match = braceRegex.exec(text)) !== null) {
    const options = match[1].split('|');
    const chosenIndex = prng.nextInt(options.length);
    const chosen = options[chosenIndex];
    text = text.slice(0, match.index) + chosen + text.slice(match.index + match[0].length);
  }
  return text;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let text = template;
  for (const [key, val] of Object.entries(vars)) {
    // Use %%VAR%% delimiters to avoid conflict with spintax {options|variants}
    text = text.split(`%%${key}%%`).join(val);
  }
  return text;
}

/** Returns deterministic data based on commune slug — no randomness at render time */
export function getCommuneStaticData(commune: Commune) {
  const rPrice = commune.marketData?.prixM2Refection || 150;
  const dPrice = commune.marketData?.prixM2Demoussage || 25;
  const rge = commune.marketData?.couvreursRGE || 5;
  const delays = commune.marketData?.delaiMoyenJours || 10;
  const geoZone = commune.microRegion || 'moyen-pays-collines';
  const altitude = commune.altitude || 50;
  const pop = commune.population || 5000;

  // Deterministic altitude zone label
  let altitudeZone = 'littoral';
  if (altitude > 800) altitudeZone = 'haute montagne';
  else if (altitude > 400) altitudeZone = 'arrière-pays';
  else if (altitude > 100) altitudeZone = 'moyen-pays';

  // Population density label
  let populationLabel = 'commune rurale';
  if (pop > 50000) populationLabel = 'grande ville';
  else if (pop > 10000) populationLabel = 'ville moyenne';
  else if (pop > 3000) populationLabel = 'bourg';

  // Climate zone qualification
  let windZone = 'Zone 2 normale';
  if (geoZone === 'littoral-riviera') windZone = 'Zone 2 à 3 (site exposé côtier)';
  if (geoZone === 'arriere-pays-montagne') windZone = 'Zone 3 (site exposé montagneux)';

  // Snow zone
  let snowZone = 'Zone A1 (gel rare)';
  if (altitude > 800) snowZone = 'Zone C1 (neige régulière)';
  else if (altitude > 400) snowZone = 'Zone B2 (neige occasionnelle)';

  // R-value requirements
  const rValueReq = altitude > 500 ? '6,5 m².K/W' : '6,0 m².K/W';

  // Dominant roof type
  const roofType = commune.roofCharacteristics?.tuileDominante || 'Tuile plate Marseille';

  // PLU link — real official link patterns for 06 communes
  const pluLink = `https://www.geoportail-urbanisme.gouv.fr/map/#tile=1&zoom=13&lat=${commune.latitude || 43.7}&lon=${commune.longitude || 7.2}&compareMap=0`;

  // ANAH subsidy estimator
  const anahLink = 'https://www.maprimerenov.gouv.fr/';

  // BDESE / INSEE page
  const inseeLink = `https://www.insee.fr/fr/statistiques/1405599?geo=COM-${commune.codeInsee}`;

  // Meteo data
  const meteoLink = `https://meteofrance.com/previsions-meteo-france/${commune.slug}-${commune.codePostal}`;

  return {
    altitudeZone,
    populationLabel,
    windZone,
    snowZone,
    rValueReq,
    roofType,
    rge,
    delays,
    rPrice: Math.round(rPrice),
    dPrice: Math.round(dPrice),
    pluLink,
    anahLink,
    inseeLink,
    meteoLink,
    geoZone,
    altitude,
    pop,
    interco: commune.intercommunalite || "Métropole Nice Côte d'Azur",
    landmark1: commune.landmarks?.[0] || 'la Riviera',
    landmark2: commune.landmarks?.[1] || 'la Côte d\'Azur',
  };
}

/** Returns 3 distinct FAQ sets per page type, seeded by commune slug */
export function getPageTypeFAQ(commune: Commune, pageType: 'refection' | 'villa' | 'expert'): { q: string; a: string }[] {
  const nom = commune.nom;
  const zip = commune.codePostal;
  const rge = commune.marketData?.couvreursRGE || 5;
  const rPrice = commune.marketData?.prixM2Refection || 150;
  const dPrice = commune.marketData?.prixM2Demoussage || 25;
  const delays = commune.marketData?.delaiMoyenJours || 10;
  const geoZone = commune.microRegion || 'moyen-pays-collines';

  if (pageType === 'refection') {
    return [
      {
        q: `Quel est le prix moyen d'une réfection de toiture à ${nom} (${zip}) en 2026 ?`,
        a: `À ${nom}, le tarif d'une réfection complète de toiture varie entre ${Math.round(rPrice * 0.95)} € et ${Math.round(rPrice * 1.35)} € le m² TTC, pose comprise. Ce prix inclut la dépose de l'ancienne couverture, la fourniture de tuiles plates Marseille neuves, un écran sous-toiture HPV haute perméabilité à la vapeur, le litonnage neuf, la refection des solins et rives, et l'évacuation des déchets. Le surcoût lié aux spécificités locales (accès difficile, contraintes ABF, matériaux nobles en bord de mer) peut représenter 10 à 20 % du devis.`
      },
      {
        q: `Quel type de tuile est recommandé à ${nom} selon les règles d'urbanisme locales ?`,
        a: geoZone === 'littoral-riviera'
          ? `À ${nom}, le PLU et l'ABF imposent des tuiles en terre cuite (canal ou plate Marseille) dans des teintes chaudes nuancées : ocre jaune, paille, flammée ou rouge naturel patiné. Les tuiles en béton ou en matière synthétique sont généralement exclues dans les secteurs patrimoniaux.`
          : `À ${nom}, les règles du PLU local s'inscrivent dans la tradition architecturale provençale. Les tuiles plates de Marseille ou les tuiles romanes en terre cuite sont le standard, dans des coloris ocre ou rouge naturel. Dans les lotissements contemporains, des solutions de couverture modernes peuvent être acceptées sous réserve d'accord en mairie.`
      },
      {
        q: `Combien de temps faut-il pour réaliser une réfection de toiture à ${nom} ?`,
        a: `Pour un toit de villa standard (environ 100 m²) à ${nom}, comptez entre 3 et 7 jours ouvrés pour une équipe de 2 à 3 couvreurs expérimentés. Le délai moyen de prise en charge par les artisans partenaires du réseau dans le ${zip} est d'environ ${delays} jours après signature du devis. Ce délai peut s'allonger en haute saison (septembre–novembre, période des orages) ou en cas de prescription ABF requérant l'approvisionnement de tuiles de modèle spécifique.`
      },
      {
        q: `Les travaux de couverture à ${nom} sont-ils éligibles aux aides de l'État ?`,
        a: `Oui, si les travaux incluent une isolation thermique de la toiture (sarking, sous-rampants) réalisée par un artisan certifié RGE, vous pouvez bénéficier de MaPrimeRénov' (jusqu'à 75 € / m² selon les revenus), des CEE (10 à 20 € / m²), de la TVA réduite à 5,5 % sur l'isolation et les travaux induits, et d'un Éco-PTZ à 0 % jusqu'à 30 000 €. On dénombre environ ${rge} entreprises certifiées RGE actives dans le secteur de ${nom} et ses communes voisines.`
      }
    ];
  }

  if (pageType === 'villa') {
    return [
      {
        q: `Comment étancher un toit terrasse de villa à ${nom} selon le DTU 43.1 ?`,
        a: `L'étanchéité d'un toit terrasse à ${nom} doit respecter le DTU 43.1. Les techniques recommandées pour le 06 sont : la membrane EPDM (durée de vie > 50 ans), l'étanchéité bitumineuse bicouche SBS ou les systèmes à base de résine liquide (SEL) pour les configurations complexes. La pente minimale réglementaire est de 1,5 % vers les évacuations. En bord de mer à ${nom}, on privilégie l'EPDM pour son insensibilité absolue aux UV et au sel marin.`
      },
      {
        q: `Quel matériau d'isolation choisir pour une toiture de villa de standing à ${nom} ?`,
        a: `Pour une villa haut de gamme à ${nom}, la méthode sarking en panneaux de polyuréthane (PIR, λ = 0,022 W/m.K) ou en fibre de bois haute densité (λ = 0,036 W/m.K) est la référence. La fibre de bois offre un déphasage thermique de 10 à 12 heures — essentiel pour maintenir la fraîcheur l'été sans climatisation à ${nom}. La résistance thermique recommandée est de R ≥ 6,0 m².K/W pour être éligible aux aides d'État et conforme aux critères RE2020.`
      },
      {
        q: `Peut-on installer une toiture végétalisée sur une villa à ${nom} ?`,
        a: `Oui, sous réserve que la dalle structurelle supporte le poids (environ 150 à 200 kg/m² de substrat saturé). À ${nom}, la végétalisation extensive à base de sédums méditerranéens est idéale car ces plantes résistent aux sécheresses estivales sans arrosage. Elle régule naturellement la chaleur par évapotranspiration et améliore le traitement des eaux pluviales. Elle doit être posée sur une étanchéité EPDM avec protection anti-racinaire certifiée FLL (standard allemand de référence).`
      },
      {
        q: `Quel est le tarif d'une installation de gouttières en cuivre à ${nom} ?`,
        a: `La pose de gouttières en cuivre naturel à ${nom} coûte entre 90 et 160 € par mètre linéaire fourni et posé (gouttière demi-ronde développement 25 à 33, descentes Ø 80 mm). Le cuivre est le seul métal garanti 100+ ans en atmosphère marine. Sa patine verte-de-gris naturelle est acceptée voire plébiscitée par les ABF pour les propriétés patrimoniales. Les soudures sont réalisées à l'étain par des zingueurs qualifiés.`
      }
    ];
  }

  // expert
  return [
    {
      q: `Comment choisir un artisan couvreur fiable et certifié à ${nom} (${zip}) ?`,
      a: `Pour sélectionner un couvreur qualifié à ${nom}, vérifiez : 1) La certification RGE Qualibat (mention "Couverture 43" ou "Charpente bois 3112") vérifiable sur qualibat.com, 2) L'attestation d'assurance Garantie Décennale et RC Pro (mentionnant explicitement "Couverture"), 3) La présence d'un SIRET local dans le 06, 4) Des avis Google My Business avec photos de chantiers locaux. Méfiez-vous des devis trop bas sans détail des matériaux ni attestation d'assurance.`
    },
    {
      q: `Quelle garantie légale couvre une réfection de toiture à ${nom} ?`,
      a: `Toute réfection de toiture à ${nom} réalisée par un professionnel est couverte par trois garanties légales : la Garantie Décennale (10 ans, couvre les dommages compromettant la solidité du bâtiment), la Garantie de Parfait Achèvement (1 an, couvre toute malfaçon signalée à la réception), et la Garantie Biennale (2 ans, couvre les équipements dissociables comme les gouttières et closoirs). Exigez une copie de l'attestation d'assurance décennale en cours de validité au moment de la signature du devis.`
    },
    {
      q: `Quand faut-il faire intervenir un couvreur en urgence à ${nom} ?`,
      a: `Une intervention urgente est nécessaire à ${nom} si : une infiltration active tache vos plafonds, des tuiles manquantes sont visibles après un orage ou des rafales, votre gouttière est arrachée par le vent et provoque des projections d'eau sur la façade, ou si vous constatez des déformations de la charpente visibles depuis l'intérieur. Les couvreurs partenaires du réseau dans le ${zip} interviennent en bâchage d'urgence dans un délai de 24 à 48 h. Signalez ensuite votre sinistre à votre assureur dans les 5 jours ouvrés.`
    },
    {
      q: `Quelles démarches administratives avant de rénover sa toiture à ${nom} ?`,
      a: `À ${nom}, une simple réfection à l'identique (mêmes matériaux, même aspect) ne nécessite généralement pas de déclaration. En revanche, si vous changez la pente, les matériaux visibles, ajoutez des fenêtres de toit ou posez des panneaux solaires, une Déclaration Préalable de Travaux est obligatoire en mairie. Si votre propriété est dans un périmètre ABF, l'avis de l'Architecte des Bâtiments de France est requis et le délai d'instruction passe à 2 mois minimum.`
    }
  ];
}

export function generateCommuneContent(commune: Commune, pageType: 'refection' | 'villa' | 'expert') {
  const rPrice = commune.marketData?.prixM2Refection || 150;
  const dPrice = commune.marketData?.prixM2Demoussage || 25;
  const minRPrice = Math.round(rPrice * 0.95);
  const maxRPrice = Math.round(rPrice * 1.35);
  const minDPrice = Math.round(dPrice * 0.85);
  const maxDPrice = Math.round(dPrice * 1.30);
  const rge = commune.marketData?.couvreursRGE || 5;
  const delays = commune.marketData?.delaiMoyenJours || 10;
  const pop = commune.population || 5000;
  const slug = commune.slug;

  const geoZone = commune.microRegion || 'moyen-pays-collines';
  const landmarks = commune.landmarks || ['la Riviera', 'la Côte d\'Azur'];
  const proxC1 = landmarks[0] || 'la Promenade des Anglais';
  
  const nearby = getSmartNearbyCommunes(slug, communes as any[], 4, 0);
  const n1 = nearby[0]?.nom || "Nice";
  const n2 = nearby[1]?.nom || "Cannes";

  const vars: Record<string, string> = {
    VILLE: commune.nom,
    ZIP: commune.codePostal,
    DEPARTEMENT: "Alpes-Maritimes",
    DEPARTEMENT_CODE: "06",
    MIN_PRIX_REF: minRPrice.toString(),
    MAX_PRIX_REF: maxRPrice.toString(),
    MIN_PRIX_DEM: minDPrice.toString(),
    MAX_PRIX_DEM: maxDPrice.toString(),
    RGE_NB: rge.toString(),
    DELAIS: delays.toString(),
    POPULATION: pop.toLocaleString('fr-FR'),
    INTERCO: commune.intercommunalite || "Métropole Nice Côte d'Azur",
    PROX_C1: proxC1,
    N1: n1,
    N2: n2
  };

  // Title templates — DISTINCT per page type (use %%VAR%% not {VAR} to avoid spintax conflict)
  let titleTemplate = "";
  if (pageType === 'refection') {
    titleTemplate = "Rénovation de Toiture à %%VILLE%% (%%ZIP%%) — Expert Couverture Alpes-Maritimes 2026";
  } else if (pageType === 'villa') {
    titleTemplate = "Toiture Terrasse & Villa de Standing à %%VILLE%% (%%ZIP%%) — Étanchéité EPDM & Sarking Premium";
  } else {
    titleTemplate = "Artisan Couvreur RGE à %%VILLE%% (%%ZIP%%) — Devis Gratuit & Garantie Décennale";
  }

  // Intro Paragraph templates — DISTINCT per page type, longer, more unique per zone
  let introTemplate = "";
  if (pageType === 'refection') {
    if (geoZone === 'littoral-riviera') {
      introTemplate = "Votre villa ou résidence à %%VILLE%% (%%ZIP%%) est exposée en permanence aux embruns salins qui corrodent les fixations de tuiles en acier zingué standard en moins de 5 ans. La rénovation de toiture sur le littoral azuréen exige l'emploi exclusif d'inox 316L ou de cuivre pour tous les éléments métalliques, conformément aux préconisations du DTU 40.21 en zone d'atmosphère marine C4/C5. Nos artisans couvreurs qualifiés RGE interviennent à %%VILLE%% entre %%MIN_PRIX_REF%% et %%MAX_PRIX_REF%% €/m², avec garantie décennale solide et approvisionnement de tuiles planes de Marseille ou tuiles canal certifiées NF EN 1304.";
    } else if (geoZone === 'arriere-pays-montagne') {
      introTemplate = "À %%VILLE%% (%%ZIP%%), les rigueurs de l'arrière-pays imposent des toitures conçues pour résister aux cycles de gel-dégel hivernaux et aux charges de neige réglementaires (zones B2 ou C1 selon l'altitude). Les tuiles doivent impérativement être certifiées «résistance au gel» (NF EN 539-2 méthode C) et chaque tuile doit être mécaniquement fixée sur les liteaux par vissage inox systématique. Nos couvreurs spécialisés en toiture de montagne du 06 rénovent votre toit entre %%MIN_PRIX_REF%% et %%MAX_PRIX_REF%% €/m² avec renforcement de la charpente et installation de pare-neige homologués.";
    } else {
      introTemplate = "Au cœur des collines du moyen-pays des Alpes-Maritimes, %%VILLE%% (%%ZIP%%) offre un cadre de vie privilégié mais impose à vos toitures des contraintes thermiques significatives : des étés brûlants (plus de 70°C sous les tuiles en plein soleil) et des orages méditerranéens d'automne de haute intensité. La rénovation de votre couverture à %%VILLE%% mobilise des couvreurs certifiés RGE, des tuiles plates Marseille NF EN 1304 et des isolants à fort déphasage thermique. Nos partenaires du 06 interviennent entre %%MIN_PRIX_REF%% et %%MAX_PRIX_REF%% €/m² pour une réfection complète garantie 10 ans.";
    }
  } else if (pageType === 'villa') {
    if (geoZone === 'littoral-riviera') {
      introTemplate = "Propriétaire d'une villa ou d'une résidence de standing à %%VILLE%% (%%ZIP%%) ? La toiture de votre propriété est un investissement stratégique sur le marché immobilier azuréen. L'étanchéité EPDM monocouche (≥ 50 ans de durabilité), les toitures terrasses accessibles sous dalles en grès sur plots, et l'isolation sarking rigide en fibre de bois (R ≥ 6 m².K/W) sont les solutions haut de gamme que nos couvreurs spécialisés mettent en œuvre à %%VILLE%%. Chaque projet bénéficie d'une conception sur mesure respectant les prescriptions de l'ABF et du PLU de la ville.";
    } else {
      introTemplate = "Votre villa ou mas provençal à %%VILLE%% (%%ZIP%%) mérite une toiture à la hauteur de sa valeur patrimoniale. L'isolation par l'extérieur (méthode Sarking en fibre de bois à haute densité, λ = 0,036 W/m.K) préserve le cachet de vos charpentes apparentes tout en assurant un déphasage thermique de 10 à 12 heures — la clé du confort naturel dans les collines de %%VILLE%% sans climatisation. Nos artisans couvreurs du 06 conçoivent et réalisent votre toiture haut de gamme, des tuiles de Marseille aux closoirs de faîtage ventilés en passant par les gouttières en cuivre façonnées à la main.";
    }
  } else {
    introTemplate = "Vous recherchez un artisan couvreur certifié à %%VILLE%% (%%ZIP%%) pour une réfection urgente, un contrôle annuel de toiture ou des travaux de zinguerie premium ? Notre réseau regroupe %%RGE_NB%% entreprises qualifiées RGE (Qualibat mention couverture 43 ou charpente 3112) couvrant %%VILLE%%, %%N1%% et %%N2%%. Délai moyen de réponse devis : %%DELAIS%% jours ouvrés. Chaque intervention est couverte par une garantie décennale en cours de validité, vérifiable sur qualibat.com. Obtenez jusqu'à 3 devis comparatifs gratuits et sans engagement.";
  }

  // Climate Context — more substantive content per zone
  let climateTemplate = "";
  if (geoZone === 'littoral-riviera') {
    climateTemplate = "Le littoral de %%VILLE%% est classé en atmosphère marine de catégorie {C4 (élevée)|C5 (très élevée)} selon la norme NF EN ISO 9223. À cette concentration en chlorures marins, les éléments métalliques basiques (zinc standard, acier galvanisé) {s'oxydent en 3 à 8 ans|présentent une corrosion perforante en moins de 10 ans}. La zone de vent applicable est {la Zone 2 site exposé côtier|la Zone 3 selon l'exposition directe}, imposant {une fixation mécanique renforcée des tuiles|le vissage d'une tuile sur trois minimum} conformément au DTU 40.21. Les relevés pluviométriques de Météo-France à %%VILLE%% montrent des {intensités maximales horaires de 80 à 120 mm en automne|cumuls journaliers pouvant dépasser 150 mm lors des épisodes méditerranéens}.";
  } else if (geoZone === 'arriere-pays-montagne') {
    climateTemplate = "À %%VILLE%%, en arrière-pays à {une altitude significative|plus de 400 mètres}, la zone climatique de neige applicable est {la zone B2|la zone C1} selon la norme NF EN 1991-1-3 (Eurocode 1). La charge de neige au sol peut atteindre {80 à 120 kg/m²|plus de 150 kg/m²} lors d'un hiver rigoureux. Les tuiles de couverture doivent impérativement {être certifiées «résistance au gel» (NF EN 539-2 méthode C)|être fixées mécaniquement à 100 % des rives et faîtages}. Des {crochets pare-neige en acier inoxydable|grilles pare-neige en égout} sont obligatoires pour protéger les passages piétons. La zone de vent est {la Zone 3 site exposé montagneux|la Zone 2 site normal selon la protection topographique}.";
  } else {
    climateTemplate = "Dans le moyen-pays de %%VILLE%%, la toiture fait face à des {amplitudes thermiques journalières de 20 à 25°C en été|températures sous tuiles pouvant dépasser 70°C en plein soleil de juillet}. La zone de vent applicable est {la Zone 2 site normal|la Zone 2 site exposé selon le relief local}, avec des rafales pouvant dépasser 100 km/h lors des épisodes de {tramontane ou mistral renforcé|vents d'est de secteur méditerranéen}. La zone de neige est {la Zone A1 (gel rare, neige exceptionnelle)|la Zone A2 selon l'altitude}. Une {ventilation continue sous-toiture de section ≥ 1/250e de la surface projetée|lame d'air ventilée d'au moins 20 mm} est indispensable pour {limiter les surchauffes des combles|maintenir la qualité de l'isolant dans le temps}.";
  }

  // ABF / Urban rules
  const abfTemplate = "{{Le PLU de %%VILLE%% {encadre la forme et les teintes des couvertures|impose le respect du paysage urbain azuréen}. {Les tuiles en terre cuite (canal ou plate Marseille) dans des teintes chaudes (ocre, paille, flammée)|Les génoises maçonnées à deux ou trois rangs} {sont la norme pour s'intégrer à l'architecture locale|restent exigées pour les bâtiments en secteur sauvegardé}. {Avant tout chantier de couverture visible depuis la rue|Si votre toit borde un espace public}, {vérifiez le PLU en ligne sur le Géoportail de l'Urbanisme|déposez une Déclaration Préalable en mairie de %%VILLE%%}. {Un arrêté de voirie sera requis|L'occupation du trottoir par l'échafaudage nécessite une autorisation municipale} pour tout montage d'échafaudage sur l'espace public.}|{Dans les secteurs contemporains de %%VILLE%%, les PLU récents autorisent {les toitures végétalisées et les toits plats avec garde-corps|les couvertures métalliques en zinc naturel ou en acier corten}. {L'installation de panneaux solaires|La pose de fenêtres de toit de type Velux encastré} {est autorisée hors secteur ABF|peut nécessiter un dossier spécifique en zone sauvegardée}. Consultez le Géoportail Urbanisme (%%VILLE%%) pour vérifier votre zonage exact avant de commander vos matériaux.}}";

  // Housing typologies
  let housingTemplate = "";
  if (geoZone === 'littoral-riviera') {
    housingTemplate = "Le parc immobilier de %%VILLE%% compte {des villas d'architecte à toiture terrasse accessible et des immeubles Belle Époque coiffés de tuiles canal|des copropriétés haut de gamme et des propriétés d'exception au bord de mer}. {La logistique de chantier y est rigoureuse|Les travaux de couverture y exigent une organisation méticuleuse} : {montage d'échafaudages ancrés sur façade, autorisation de voirie mairie, grutage de tuiles dans des rues étroites|protections collectives contre la chute de hauteur conforme à la norme NF P 93-520}. {L'ensemble des charpentes et des solins|Les étanchéités de toit terrasse} {sont vérifiés par un relevé d'état des lieux|font l'objet d'une mise à l'eau colorée diagnostique avant réfection}.";
  } else {
    housingTemplate = "L'habitat de %%VILLE%% se caractérise par {des bastides en pierre du moyen-pays, des mas provençaux à forte pente et des maisons individuelles des années 1970-1990|des villas individuelles sur terrain arboré et des granges anciennement réhabilitées en résidence principale}. {La charpente traditionnelle en bois de sapin ou de chêne|Les pannes et chevrons anciens} {est inspectée en détail avant toute réfection|révèle parfois la présence de capricornes ou de termites dans le bois sec des collines méditerranéennes}. {La présence de pins d'Alep ou de chênes verts|La végétation dense autour des propriétés de %%VILLE%%} {justifie l'installation de grilles pare-feuilles certifiées sur les gouttières|provoque l'accumulation rapide de feuilles mortes dans les chéneaux entre septembre et novembre}.";
  }

  // Energy/Market
  const energyTemplate = "{Dans les Alpes-Maritimes, l'isolation thermique de toiture est {le poste de travaux le plus rentable sur la Côte d'Azur|le levier clé pour réduire votre consommation de climatisation de 25 à 35 %}. {Associer la réfection de couverture à la pose d'un isolant sarking R ≥ 6 m².K/W en fibre de bois|L'installation d'un pare-vapeur continu avec panneau rigide PIR} {permet de grouper les aides et de minimiser les coûts de montage d'échafaudage|réduit les ponts thermiques à zéro et protège la charpente de la condensation}. {Les primes CEE et MaPrimeRénov' 2026 couvrent jusqu'à 50% du coût de l'isolation|La TVA réduite à 5,5 % s'applique directement sur la facture de l'artisan certifié RGE}.|{Sur la Côte d'Azur, le DPE (Diagnostic de Performance Énergétique) d'un bien immobilier est fortement influencé par la qualité de l'isolation de toiture|Les acheteurs immobiliers à %%VILLE%% sont de plus en plus attentifs à l'étiquette énergétique des villas}. {Améliorer la lettre DPE de E vers C grâce à une isolation de toiture performante|Réaliser l'isolation simultanément à la réfection} {peut augmenter la valeur de revente de votre villa de 5 à 8 %|permet de regrouper les aides d'État et de réaliser l'intégralité du chantier en une seule mobilisation d'échafaudage}.}";

  const realEstateTemplate = "{La rénovation d'une toiture à %%VILLE%% est {un argument commercial incontestable sur le marché immobilier azuréen|un investissement qui offre l'un des meilleurs ROI du patrimoine bâti}. {Une couverture neuve avec facture décennale d'un artisan RGE du 06|Un toit terrasse étanché EPDM avec procès-verbal d'étanchéité} {rassure pleinement les acquéreurs et les notaires|permet d'obtenir la meilleure valorisation lors d'une expertise immobilière}. Sur le marché de %%VILLE%%, {une villa avec toit rénové se vend en moyenne 15 à 20 jours plus vite|les acheteurs exigeants négocient moins agressivement le prix quand le toit est récent}.|{Sur le marché immobilier de %%VILLE%% et du 06|Pour les investisseurs locatifs et les propriétaires bailleurs sur la Riviera}, {l'état du toit est la première question posée par les acquéreurs|une toiture vétuste peut faire chuter le prix de vente de 3 à 8 %}. {Investir dans une réfection de qualité avant la mise en vente|Présenter une attestation de garantie décennale récente lors des visites} {est la stratégie la plus sûre pour défendre votre prix|démontre le sérieux et la rigueur avec lesquels vous avez entretenu votre propriété}.}";

  // Parse
  const finalTitle = replaceVariables(parseSpintax(slug, 'title', titleTemplate), vars);
  const finalIntro = replaceVariables(parseSpintax(slug, 'intro', introTemplate), vars);
  const finalClimate = replaceVariables(parseSpintax(slug, 'climate', climateTemplate), vars);
  const finalAbf = replaceVariables(parseSpintax(slug, 'abf', abfTemplate), vars);
  const finalHousing = replaceVariables(parseSpintax(slug, 'housing', housingTemplate), vars);
  const finalEnergy = replaceVariables(parseSpintax(slug, 'energy', energyTemplate), vars);
  const finalRealEstate = replaceVariables(parseSpintax(slug, 'realestate', realEstateTemplate), vars);

  // Use page-type-specific FAQ to avoid duplication
  const faqItems = getPageTypeFAQ(commune, pageType);

  return {
    title: finalTitle,
    introParagraph: finalIntro,
    climateContext: finalClimate,
    abfRegulations: finalAbf,
    housingTypologyInsight: finalHousing,
    energyProfileText: finalEnergy,
    realEstateInsight: finalRealEstate,
    faqItems
  };
}

// French counterpart of en.ts -- same flat, theme-free, family-friendly pool,
// filtered/deduped by `sanitizeWordBank` (../generator.ts) at import time.
// Only single unbroken tokens (no spaces/hyphens/apostrophes), since a
// word-search placement can't span a gap -- accents are kept (e.g. "forêt",
// "être") since stripping them would make the word unrecognizable.
export const FR_WORDS: string[] = [
  // animaux
  'chat', 'chien', 'vache', 'cochon', 'poule', 'renard', 'hibou', 'abeille',
  'fourmi', 'chauve', 'souris', 'ours', 'loup', 'lion', 'cerf', 'grenouille',
  'canard', 'chèvre', 'agneau', 'phoque', 'crabe', 'papillon', 'ver', 'faucon',
  'cygne', 'mulet', 'taupe', 'oiseau', 'poisson', 'cheval', 'mouton', 'tigre',
  'zèbre', 'chameau', 'loutre', 'lapin', 'singe', 'tortue', 'dauphin', 'girafe',
  'pingouin', 'panthère', 'léopard', 'éléphant', 'kangourou', 'écureuil',
  'hérisson', 'poulet', 'âne', 'chiot', 'chaton', 'baleine', 'requin', 'serpent',
  'lézard', 'araignée', 'criquet', 'panda', 'koala', 'gorille', 'buffle',
  'morse', 'aigle', 'corbeau', 'moineau', 'pigeon', 'perroquet', 'paon',
  'autruche', 'flamant', 'méduse', 'poulpe', 'homard', 'huître', 'saumon',
  'truite', 'blaireau', 'castor', 'putois', 'raton', 'coyote', 'jaguar',
  'guépard', 'cobra', 'python', 'gecko', 'iguane',

  // nourriture et boissons
  'pomme', 'raisin', 'citron', 'mangue', 'melon', 'pêche', 'cerise', 'banane',
  'orange', 'poire', 'fraise', 'olive', 'oignon', 'carotte', 'tomate',
  'poivron', 'chou', 'laitue', 'épinard', 'citrouille', 'concombre', 'brocoli',
  'champignon', 'avocat', 'ananas', 'noix', 'amande', 'cajou', 'fromage',
  'beurre', 'yaourt', 'crème', 'sucre', 'farine', 'pain', 'bacon', 'saucisse',
  'pizza', 'nouille', 'céréale', 'crêpe', 'gaufre', 'biscuit', 'muffin',
  'beignet', 'chocolat', 'vanille', 'miel', 'sirop', 'confiture', 'salade',
  'soupe', 'ragoût', 'curry', 'riz', 'haricot', 'lentille', 'café', 'thé',
  'jus', 'eau', 'lait', 'vin', 'bière', 'cidre', 'sandwich', 'omelette',
  'cornichon', 'moutarde', 'vinaigre', 'cannelle', 'basilic', 'thym', 'persil', 'origan',

  // maison
  'table', 'chaise', 'canapé', 'lampe', 'miroir', 'couverture', 'oreiller',
  'rideau', 'tapis', 'armoire', 'tiroir', 'étagère', 'placard', 'cuisine',
  'chambre', 'fenêtre', 'plafond', 'escalier', 'cheminée', 'couloir',
  'parapluie', 'panier', 'seau', 'balai', 'éponge', 'serviette', 'assiette',
  'cuillère', 'fourchette', 'couteau', 'bouilloire', 'four', 'aspirateur',
  'bougie', 'lanterne', 'batterie', 'télécommande', 'clavier', 'écran',
  'imprimante', 'caméra', 'calendrier', 'cahier', 'enveloppe', 'agrafeuse',
  'ciseaux', 'règle', 'gomme', 'crayon', 'marqueur', 'autocollant',

  // nature
  'montagne', 'vallée', 'rivière', 'océan', 'forêt', 'désert', 'île',
  'volcan', 'glacier', 'cascade', 'prairie', 'jungle', 'marais', 'grotte',
  'falaise', 'plage', 'rivage', 'nuage', 'tonnerre', 'éclair', 'tempête',
  'gel', 'glaçon', 'avalanche', 'marée', 'vague', 'courant', 'galet', 'rocher',
  'gravier', 'sol', 'boue', 'poussière', 'cendre', 'fumée', 'flamme',
  'étincelle', 'braise',

  // corps
  'tête', 'cou', 'épaule', 'coude', 'poignet', 'doigt', 'pouce', 'genou',
  'cheville', 'talon', 'poitrine', 'estomac', 'colonne', 'muscle', 'sourcil',
  'front', 'joue', 'menton', 'langue', 'gorge', 'poumon', 'cœur', 'cerveau',
  'rein', 'foie', 'peau', 'ongle', 'cheveux',

  // famille et gens
  'mère', 'père', 'sœur', 'frère', 'cousin', 'neveu', 'nièce', 'mari',
  'femme', 'ami', 'voisin', 'professeur', 'élève', 'docteur', 'infirmière',
  'fermier', 'peintre', 'chanteur', 'danseur', 'écrivain', 'chauffeur',
  'pilote', 'marin', 'soldat', 'policier', 'pompier', 'plombier', 'boulanger',
  'boucher', 'tailleur', 'coiffeur', 'serveur',

  // vêtements
  'chemise', 'veste', 'pull', 'chaussette', 'gant', 'écharpe', 'chapeau',
  'casquette', 'botte', 'chaussure', 'sandale', 'robe', 'jupe', 'pantalon',
  'short', 'manteau', 'gilet', 'pyjama', 'ceinture', 'cravate', 'bouton',
  'poche', 'manche', 'capuche', 'mitaine', 'tablier',

  // couleurs et formes
  'rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet', 'rose', 'marron',
  'noir', 'blanc', 'gris', 'argent', 'doré', 'cercle', 'carré', 'triangle',
  'rectangle', 'losange', 'ovale', 'cube', 'sphère', 'cylindre', 'pyramide', 'spirale',

  // sports et jeux
  'football', 'tennis', 'hockey', 'rugby', 'golf', 'boxe', 'lutte', 'natation',
  'course', 'cyclisme', 'patinage', 'surf', 'plongée', 'escalade', 'bowling',
  'échecs', 'dames', 'puzzle', 'domino', 'bille', 'ballon', 'toupie', 'sifflet',
  'trophée', 'médaille', 'arbitre', 'stade', 'raquette', 'casque',

  // verbes
  'sauter', 'courir', 'marcher', 'nager', 'danser', 'chanter', 'rire',
  'sourire', 'chuchoter', 'crier', 'écouter', 'regarder', 'rêver', 'dormir',
  'grimper', 'ramper', 'glisser', 'lancer', 'attraper', 'embrasser', 'saluer',
  'applaudir', 'cuisiner', 'cuire', 'couper', 'trancher', 'verser', 'mélanger',
  'remuer', 'bouillir', 'geler', 'fondre', 'grandir', 'planter', 'arroser',
  'récolter', 'construire', 'peindre', 'dessiner', 'écrire', 'lire',
  'apprendre', 'enseigner', 'étudier', 'penser', 'imaginer', 'créer',
  'inventer', 'découvrir', 'explorer', 'voyager', 'arriver', 'partir', 'revenir',

  // technologie
  'ordinateur', 'portable', 'tablette', 'téléphone', 'internet', 'logiciel',
  'matériel', 'clavier', 'écran', 'imprimante', 'scanner', 'routeur',
  'batterie', 'chargeur', 'casque', 'microphone', 'caméra', 'vidéo', 'photo',
  'image', 'message',

  // transport
  'voiture', 'camion', 'autobus', 'train', 'avion', 'hélicoptère', 'vélo',
  'moto', 'trottinette', 'bateau', 'navire', 'canoë', 'kayak', 'fusée',
  'métro', 'tracteur', 'chariot', 'traîneau', 'ascenseur', 'autoroute',
  'pont', 'tunnel', 'aéroport', 'gare', 'port', 'piste', 'garage',

  // musique et art
  'guitare', 'piano', 'violon', 'tambour', 'trompette', 'flûte', 'clarinette',
  'saxophone', 'harpe', 'orchestre', 'mélodie', 'rythme', 'chœur', 'concert',
  'peinture', 'sculpture', 'toile', 'palette', 'pinceau', 'croquis',
  'portrait', 'galerie', 'musée', 'théâtre', 'cinéma', 'costume', 'masque',

  // école
  'crayon', 'gomme', 'cahier', 'manuel', 'devoir', 'classe', 'professeur',
  'élève', 'leçon', 'examen', 'note', 'diplôme', 'bibliothèque', 'cantine',
  'récréation', 'science', 'histoire', 'chimie', 'physique', 'biologie',
  'langue', 'grammaire',

  // divers
  'château', 'pont', 'tour', 'palais', 'temple', 'église', 'cathédrale',
  'village', 'ville', 'pays', 'nation', 'planète', 'galaxie', 'univers',
  'comète', 'météore', 'satellite', 'télescope', 'boussole', 'carte',
  'globe', 'trésor', 'pirate', 'dragon', 'sorcier', 'chevalier', 'princesse',
  'royaume', 'aventure', 'mystère', 'secret', 'énigme', 'légende', 'mythe',
  'fable', 'poème', 'roman', 'chapitre', 'lettre', 'journal', 'souvenir',
  'moment', 'avenir', 'passé', 'présent',
];
